import type { SimStep } from '../kit/types';

/** react-race: two coffees, the second arrives first. */
export const MODES = [
  { id: 'none', label: 'No cleanup' },
  { id: 'fix', label: 'With cleanup' },
] as const;
export type Mode = (typeof MODES)[number]['id'];

export const FIXES = [
  { id: 'flag', label: 'ignore flag in cleanup' },
  { id: 'abort', label: 'AbortController' },
  { id: 'rq', label: 'React Query / key-based cache' },
] as const;
export type Fix = (typeof FIXES)[number]['id'];

export interface Options {
  fix: Fix;
  latencyJa: number; // ticks until the "ja" response lands
  latencyJav: number;
  strictMode: boolean;
  missingDep: boolean;
}

export type ReqStatus = 'flying' | 'arrived' | 'ignored' | 'aborted' | 'cached';
export interface Req {
  q: string;
  sentAt: number;
  arrivesAt: number;
  status: ReqStatus;
  /** which effect run sent it; Strict Mode makes two runs for the same query */
  run: number;
}

export interface RaceState {
  t: number;
  query: string;
  results: string | null; // results shown, tagged with the query they belong to
  requests: Req[];
  effectRuns: number;
  /** code lines to highlight (1-based) in the useEffect listing */
  highlight: number[];
  wrong: boolean;
  done: boolean;
}

export function codeFor(mode: Mode, fix: Fix, missingDep: boolean): string[] {
  const dep = missingDep ? '[]  // ← missing dependency: query' : '[query]';
  if (mode === 'none') {
    return ['useEffect(() => {', '  fetch(`/search?q=${query}`)', '    .then(r => r.json())', '    .then(data => setResults(data));', `}, ${dep});`];
  }
  if (fix === 'flag') {
    return ['useEffect(() => {', '  let cancelled = false;', '  fetch(`/search?q=${query}`)', '    .then(r => r.json())', '    .then(data => { if (!cancelled) setResults(data); });', '  return () => { cancelled = true; };   // cleanup', `}, ${dep});`];
  }
  if (fix === 'abort') {
    return ['useEffect(() => {', '  const ac = new AbortController();', '  fetch(`/search?q=${query}`, { signal: ac.signal })', '    .then(r => r.json())', '    .then(data => setResults(data))', "    .catch(e => { if (e.name !== 'AbortError') throw e; });", '  return () => ac.abort();              // cleanup', `}, ${dep});`];
  }
  return ["const { data } = useQuery({", "  queryKey: ['search', query],        // results are keyed by the query", '  queryFn: () => fetch(`/search?q=${query}`).then(r => r.json()),', '});', '// no effect, no race: the UI reads the entry for the CURRENT key'];
}

const stepsBase = (o: Options) => ({ latencyJa: Math.max(1, o.latencyJa), latencyJav: Math.max(1, o.latencyJav) });

export function buildSteps(mode: Mode, opts: Options): SimStep<RaceState>[] {
  const { fix, strictMode, missingDep } = opts;
  const { latencyJa, latencyJav } = stepsBase(opts);
  const fixed = mode === 'fix';
  let st: RaceState = { t: 0, query: '', results: null, requests: [], effectRuns: 0, highlight: [], wrong: false, done: false };
  const steps: SimStep<RaceState>[] = [
    { state: st, en: 'You will type "ja", then "jav". Two requests go out; the first one is slower. Predict what the results panel shows at the end.', bn: 'তুমি "ja" তারপর "jav" লিখবে। দুটো request যাবে; প্রথমটা ধীর। শেষে results-এ কী দেখাবে অনুমান করো।' },
  ];
  const push = (next: RaceState, en: string, bn: string, tone?: 'ok' | 'bad' | 'wait') => {
    st = next;
    steps.push({ state: next, en, bn, tone });
  };
  const clone = (): RaceState => ({ ...st, requests: st.requests.map((r) => ({ ...r })), highlight: [...st.highlight] });
  const effectLine = fixed && fix !== 'rq' ? 1 : 1;
  const cleanupLine = fix === 'flag' ? 6 : fix === 'abort' ? 7 : 0;

  // Type "ja"
  let s = clone();
  s.t = 1;
  s.query = 'ja';
  s.effectRuns = 1;
  s.requests.push({ q: 'ja', sentAt: 1, arrivesAt: 1 + latencyJa, status: 'flying', run: 1 });
  s.highlight = [effectLine, 2, 3];
  push(s, `You type "ja". The effect runs and sends request A for "ja" (arrives in ${latencyJa} ticks).`, `"ja" লিখলে। Effect চলল, request A গেল (${latencyJa} tick পরে আসবে)।`);

  if (strictMode) {
    s = clone();
    if (fixed && fix !== 'rq') {
      s.requests[0].status = fix === 'abort' ? 'aborted' : 'ignored';
      s.requests.push({ q: 'ja', sentAt: 1, arrivesAt: 1 + latencyJa, status: 'flying', run: 2 });
      s.effectRuns = 2;
      s.highlight = [cleanupLine];
      push(s, `Strict Mode (dev only): React runs cleanup and the effect again to check you wrote it right. Request A is ${fix === 'abort' ? 'aborted' : 'marked ignored'}, request A′ goes out. Harmless.`, `Strict Mode: React cleanup চালিয়ে effect আবার চালাল। আগেরটা বাতিল, নতুনটা গেল। ক্ষতি নেই।`, 'ok');
    } else if (fixed && fix === 'rq') {
      push(s, 'Strict Mode: the component renders twice, but React Query dedupes by key — still one request for "ja".', 'Strict Mode-এ দুবার render, কিন্তু React Query key দিয়ে dedupe করে — একটাই request।', 'ok');
    } else {
      s.requests.push({ q: 'ja', sentAt: 1, arrivesAt: 1 + latencyJa, status: 'flying', run: 2 });
      s.effectRuns = 2;
      s.highlight = [2];
      push(s, 'Strict Mode: React runs the effect twice. Without cleanup that is two live requests for "ja". Strict Mode is exposing the missing cleanup.', 'Strict Mode-এ effect দুবার চলল। Cleanup নেই বলে দুটো request বেঁচে আছে।', 'bad');
    }
  }

  // Type "jav"
  s = clone();
  s.t = 2;
  s.query = 'jav';
  if (missingDep && fix !== 'rq') {
    s.highlight = [codeFor(mode, fix, true).length];
    push(s, 'You type "jav". The dependency array is empty, so the effect does NOT run again. No request for "jav" is ever sent: the effect still remembers "ja" (stale closure).', '"jav" লিখলে, কিন্তু dependency array খালি — effect আবার চলল না। "jav"-এর request গেলই না (stale closure)।', 'bad');
  } else {
    if (fixed && fix !== 'rq') {
      for (const r of s.requests) if (r.status === 'flying') r.status = fix === 'abort' ? 'aborted' : 'ignored';
      s.highlight = [cleanupLine];
      push(s, `You type "jav". Before the new effect runs, React calls the cleanup of the old one: request${s.requests.length > 1 ? 's' : ''} for "ja" ${fix === 'abort' ? 'are aborted (✕)' : 'are flagged "ignore me"'}.`, `"jav" লিখলে। নতুন effect-এর আগে React পুরনোটার cleanup চালাল: "ja"-এর request ${fix === 'abort' ? 'abort হলো' : '"আমাকে উপেক্ষা করো" flag পেল'}।`, 'ok');
      s = clone();
    }
    s.effectRuns += 1;
    s.requests.push({ q: 'jav', sentAt: 2, arrivesAt: 2 + latencyJav, status: 'flying', run: s.effectRuns });
    s.highlight = fix === 'rq' && fixed ? [2, 3] : [effectLine, fixed && fix === 'flag' ? 3 : 2];
    push(s, `The effect runs for "jav" and sends request B (arrives in ${latencyJav} ticks).`, `"jav"-এর জন্য effect চলল, request B গেল (${latencyJav} tick)।`);
  }

  // Time passes until every flying request lands
  const maxT = Math.max(...s.requests.map((r) => r.arrivesAt), 3);
  for (let t = 3; t <= maxT; t++) {
    const landing = st.requests.filter((r) => r.arrivesAt === t && (r.status === 'flying' || r.status === 'ignored'));
    if (landing.length === 0) continue;
    for (const land of landing) {
      s = clone();
      s.t = t;
      const r = s.requests.find((x) => x.q === land.q && x.run === land.run)!;
      if (r.status === 'ignored') {
        r.status = 'ignored';
        s.highlight = [5];
        push(s, `Response for "${r.q}" arrives late, but its closure sees cancelled = true and does nothing. Results stay for "${s.results ? (s.results.includes('jav') ? 'jav' : 'ja') : '—'}".`, `"${r.q}"-এর উত্তর দেরিতে এল, কিন্তু cancelled = true দেখে চুপ থাকল।`, 'ok');
        continue;
      }
      r.status = fixed && fix === 'rq' ? 'cached' : 'arrived';
      if (fixed && fix === 'rq') {
        s.highlight = [2];
        const shows = s.query;
        s.results = `results for "${shows}"`;
        push(s, `Response for "${r.q}" lands in the cache under key ['search', '${r.q}']. The screen reads the entry for the current key "${s.query}", so it shows ${r.q === s.query ? 'these results' : 'nothing from this response'}.`, `"${r.q}"-এর উত্তর cache-এ নিজের key-তে গেল। স্ক্রিন বর্তমান key "${s.query}"-এর entry দেখায়।`, 'ok');
        continue;
      }
      s.results = `results for "${r.q}"`;
      s.highlight = [mode === 'none' ? 4 : 5];
      const wrong = r.q !== s.query;
      s.wrong = wrong;
      push(
        s,
        wrong
          ? `Response for "${r.q}" arrives LAST and calls setResults. The box now shows "${r.q}" results under the query "${s.query}". Wrong, and nothing will fix it until the user types again.`
          : `Response for "${r.q}" arrives and calls setResults. The box shows "${r.q}" results, matching the query.`,
        wrong ? `"${r.q}"-এর উত্তর সবার শেষে এল আর setResults করল। এখন "${s.query}" query-র নিচে "${r.q}"-এর ফল। ভুল।` : `"${r.q}"-এর উত্তর এল, ফল মিলল।`,
        wrong ? 'bad' : 'ok',
      );
    }
  }

  const final = clone();
  final.done = true;
  final.highlight = [];
  const shown = final.results ?? 'nothing';
  const ok = !final.wrong && final.results === `results for "${final.query}"`;
  final.wrong = !ok;
  push(
    final,
    ok ? `End: query "${final.query}", panel shows ${shown}. Correct.` : `End: query "${final.query}", panel shows ${shown}. The screen is lying to the user.`,
    ok ? `শেষ: query "${final.query}", ফল ঠিক।` : `শেষ: query "${final.query}", কিন্তু স্ক্রিনে ${shown}। স্ক্রিন মিথ্যা বলছে।`,
    ok ? 'ok' : 'bad',
  );
  return steps;
}

export function finalShows(mode: Mode, opts: Options): string {
  const s = buildSteps(mode, opts);
  return s[s.length - 1].state.results ?? 'nothing';
}
