import type { SimStep } from '../kit/types';

/** cache-stampede: everyone wants the newspaper the second it sells out. */
export const MODES = [
  { id: 'none', label: 'No protection' },
  { id: 'fix', label: 'Protected' },
] as const;
export type Mode = (typeof MODES)[number]['id'];

export const STRATEGIES = [
  { id: 'lock', label: 'lock + single refresh' },
  { id: 'swr', label: 'stale-while-revalidate' },
  { id: 'jitter', label: 'jittered TTL' },
] as const;
export type Strategy = (typeof STRATEGIES)[number]['id'];

export const SNIPPETS: Record<Strategy | 'none', string> = {
  none: `// every request does this when the key is empty
$paper = Cache::remember('front-page', 60, fn () => DB::table('news')->latest()->first());
// 1,000 requests at 9:00:01 → 1,000 misses → 1,000 queries`,
  lock: `$paper = Cache::get('front-page');
if ($paper === null) {
    $lock = Cache::lock('front-page:refresh', 10);
    if ($lock->get()) {                       // one request wins
        $paper = DB::table('news')->latest()->first();
        Cache::put('front-page', $paper, 60);
        $lock->release();
    } else {                                   // everyone else waits, then reads
        $lock->block(5);
        $paper = Cache::get('front-page');
    }
}`,
  swr: `// Laravel 11+: serve stale for 60s, refresh in the background after 30s
$paper = Cache::flexible('front-page', [30, 60], fn () => DB::table('news')->latest()->first());`,
  jitter: `// spread expiry so caches do not all die in the same second
$ttl = 60 + random_int(0, 15);
$paper = Cache::remember('front-page', $ttl, fn () => DB::table('news')->latest()->first());`,
};

export interface CacheBox {
  label: string;
  expiresAt: number;
  status: 'fresh' | 'stale' | 'empty' | 'refreshing';
}

export interface StampedeState {
  t: number;
  ttl: number;
  requests: number;
  caches: CacheBox[];
  served: { fromCache: number; fromDb: number; waiting: number; stale: number };
  dbQueries: number;
  dbLoad: number; // 0..100
  latencyMs: number;
  overloaded: boolean;
  done: boolean;
}

/** The DB can absorb about 50 concurrent queries before it slows down. */
export const DB_CAPACITY = 50;

export function loadFor(queries: number): number {
  return Math.min(100, Math.round((100 * queries) / DB_CAPACITY));
}

function initial(ttl: number, requests: number, boxes: number): StampedeState {
  const caches: CacheBox[] = Array.from({ length: boxes }, (_, i) => ({
    label: boxes === 1 ? 'cache' : `cache ${i + 1}`,
    expiresAt: boxes === 1 ? ttl : ttl + i * 2,
    status: 'fresh',
  }));
  return { t: 0, ttl, requests, caches, served: { fromCache: 0, fromDb: 0, waiting: 0, stale: 0 }, dbQueries: 0, dbLoad: 0, latencyMs: 20, overloaded: false, done: false };
}

export function buildSteps(mode: Mode, strategy: Strategy = 'lock', requests = 1000, ttl = 10): SimStep<StampedeState>[] {
  const jitter = mode === 'fix' && strategy === 'jitter';
  let st = initial(ttl, requests, jitter ? 5 : 1);
  const steps: SimStep<StampedeState>[] = [
    { state: st, en: `The counter has today's paper (cache, TTL ${ttl}s). ${requests.toLocaleString()} customers will arrive the second it expires. Predict the database load.`, bn: `Counter-এ আজকের কাগজ আছে (cache, ${ttl}s)। মেয়াদ শেষ হওয়ার সেকেন্ডেই ${requests.toLocaleString()} জন আসবে। DB-র চাপ অনুমান করো।` },
  ];
  const push = (next: StampedeState, en: string, bn: string, tone?: 'ok' | 'bad' | 'wait') => {
    st = next;
    steps.push({ state: next, en, bn, tone });
  };
  const clone = (): StampedeState => ({ ...st, caches: st.caches.map((c) => ({ ...c })), served: { ...st.served } });

  // Countdown in 3 ticks
  for (const frac of [0.5, 0.9]) {
    const s = clone();
    s.t = Math.round(ttl * frac);
    s.served.fromCache += Math.round(requests * 0.1);
    push(s, `${s.t}s: the paper is still fresh. A few customers read the copy on the counter (cache hits). DB is idle.`, `${s.t}s: কাগজ এখনো fresh। কিছু customer counter থেকেই পড়ছে (cache hit)। DB নিরিবিলি।`, 'ok');
  }

  if (jitter) {
    // Five caches expire at different seconds; each wave is only a fifth of the crowd.
    for (let i = 0; i < 5; i++) {
      const s = clone();
      s.t = s.caches[i].expiresAt;
      s.caches[i].status = 'empty';
      const wave = Math.round(requests / 5);
      s.dbQueries = 1;
      s.dbLoad = loadFor(1);
      s.served.fromDb += 1;
      s.served.fromCache += wave - 1;
      s.caches[i].status = 'fresh';
      s.caches[i].expiresAt += ttl;
      push(s, `${s.t}s: only ${s.caches[i].label} expires (its TTL had extra jitter). One refresh, the other four copies keep serving. DB load ${s.dbLoad}%.`, `${s.t}s: শুধু ${s.caches[i].label} শেষ হলো। একটা refresh, বাকি চারটা copy চলছে। DB চাপ ${s.dbLoad}%।`, 'ok');
    }
    const s = clone();
    s.done = true;
    push(s, `Done: 5 small refreshes instead of one stampede. The crowd never lines up at the same second.`, `শেষ: এক stampede-এর বদলে ৫টা ছোট refresh।`, 'ok');
    return steps;
  }

  // Expiry moment
  let s = clone();
  s.t = ttl;
  s.caches[0].status = mode === 'fix' && strategy === 'swr' ? 'stale' : 'empty';
  push(s, `${ttl}s: the paper expires. ${requests.toLocaleString()} customers arrive in the same second.`, `${ttl}s: কাগজের মেয়াদ শেষ। একই সেকেন্ডে ${requests.toLocaleString()} জন এল।`, 'wait');

  if (mode === 'none') {
    s = clone();
    s.dbQueries = requests;
    s.dbLoad = loadFor(requests);
    s.overloaded = s.dbLoad >= 100;
    s.latencyMs = s.overloaded ? 20 * Math.ceil(requests / DB_CAPACITY) : 20;
    s.served.fromDb = requests;
    push(s, `Every customer finds the counter empty and walks into the print room: ${requests.toLocaleString()} identical queries hit the database at once. Load ${s.dbLoad}%${s.overloaded ? ' — overloaded' : ''}, responses take ~${s.latencyMs}ms.`, `সবাই খালি counter দেখে print room-এ ঢুকল: ${requests.toLocaleString()} একই query DB-তে। চাপ ${s.dbLoad}%।`, 'bad');
    s = clone();
    s.caches[0].status = 'fresh';
    s.caches[0].expiresAt = ttl * 2;
    s.done = true;
    push(s, `${requests.toLocaleString()} queries later, the cache is refilled ${requests.toLocaleString()} times with the same paper. Everyone waited ~${s.latencyMs}ms. That was a stampede.`, `${requests.toLocaleString()} query-র পরে একই কাগজ ${requests.toLocaleString()} বার cache-এ। এটাই stampede।`, 'bad');
    return steps;
  }

  if (strategy === 'lock') {
    s = clone();
    s.dbQueries = 1;
    s.dbLoad = loadFor(1);
    s.served.fromDb = 1;
    s.served.waiting = requests - 1;
    s.caches[0].status = 'refreshing';
    push(s, `One customer takes the lock and goes to the print room. The other ${(requests - 1).toLocaleString()} wait at the counter (amber). DB load ${s.dbLoad}%.`, `একজন lock নিয়ে print room-এ গেল। বাকি ${(requests - 1).toLocaleString()} জন counter-এ অপেক্ষা করছে। DB চাপ ${s.dbLoad}%।`, 'wait');
    s = clone();
    s.caches[0].status = 'fresh';
    s.caches[0].expiresAt = ttl * 2;
    s.served.fromCache += requests - 1;
    s.served.waiting = 0;
    s.latencyMs = 40;
    s.done = true;
    push(s, `The fresh paper lands on the counter, the lock is released, and the ${(requests - 1).toLocaleString()} waiting customers read it. One query, everyone served in ~40ms.`, `নতুন কাগজ counter-এ এল, lock ছাড়া হলো, অপেক্ষমাণ সবাই পড়ল। একটা query।`, 'ok');
    return steps;
  }

  // stale-while-revalidate
  s = clone();
  s.served.stale = requests;
  s.served.fromCache = requests;
  s.dbQueries = 1;
  s.dbLoad = loadFor(1);
  s.caches[0].status = 'refreshing';
  push(s, `Everyone gets yesterday's paper immediately (stale, still readable) while one request refreshes in the background. DB load ${s.dbLoad}%, responses ~20ms.`, `সবাই সাথে সাথে পুরনো কাগজটা পেল (stale), একজন background-এ নতুনটা আনছে। DB চাপ ${s.dbLoad}%।`, 'ok');
  s = clone();
  s.caches[0].status = 'fresh';
  s.caches[0].expiresAt = ttl * 2;
  s.done = true;
  push(s, `The refresh finishes and the next customer gets the new paper. Nobody waited, the database saw one query.`, `Refresh শেষ, পরের customer নতুন কাগজ পাবে। কেউ অপেক্ষা করেনি, DB একটা query দেখল।`, 'ok');
  return steps;
}

export function peakLoad(mode: Mode, strategy: Strategy = 'lock', requests = 1000, ttl = 10): number {
  return Math.max(...buildSteps(mode, strategy, requests, ttl).map((s) => s.state.dbLoad));
}
