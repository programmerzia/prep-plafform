import { useMemo, useState } from 'react';
import { Chip, Chips, Muted } from '../ui/primitives';
import { SimShell } from './kit';
import { buildSteps, loadFor, MODES, peakLoad, SNIPPETS, STRATEGIES, type Mode, type StampedeState, type Strategy } from './logic/cache-stampede';

export default function CacheStampedeSimulator() {
  const [mode, setMode] = useState<Mode>('none');
  const [strategy, setStrategy] = useState<Strategy>('lock');
  const [requests, setRequests] = useState(1000);
  const [ttl, setTtl] = useState(10);
  const steps = useMemo(() => buildSteps(mode, strategy, requests, ttl), [mode, strategy, requests, ttl]);
  const peak = peakLoad(mode, strategy, requests, ttl);

  const prediction = useMemo(
    () => ({
      question: `${requests.toLocaleString()} requests arrive the second the cache expires. How high does the database load go?`,
      choices: [
        { id: 'low', label: 'Barely moves (one query)' },
        { id: 'mid', label: `Around ${loadFor(Math.round(requests / 5))}%` },
        { id: 'full', label: `${loadFor(requests)}%${loadFor(requests) >= 100 ? ' — overloaded' : ''}` },
      ],
      correct: peak <= 5 ? 'low' : peak >= loadFor(requests) ? 'full' : 'mid',
      actual: `${peak}% peak load`,
    }),
    [requests, peak],
  );

  return (
    <SimShell<StampedeState>
      id="cache-stampede"
      title="Everyone wants the newspaper the second it sells out"
      story="A shop keeps one copy of today's paper on the counter (the cache). At 9:00 it expires. 1,000 customers arrive at 9:00:01. Do they all march into the print room, or does one person fetch a copy while the rest wait or read yesterday's?"
      storyBn="দোকানের counter-এ একটা কাগজ (cache)। ৯টায় মেয়াদ শেষ। ৯:০০:০১-এ ১০০০ জন এল। সবাই print room-এ ঢুকবে, নাকি একজন আনবে আর বাকিরা অপেক্ষা করবে?"
      modes={[...MODES]}
      mode={mode}
      onMode={(m) => setMode(m as Mode)}
      extras={
        <div className="flex flex-col gap-2">
          {mode === 'fix' && (
            <Chips>
              {STRATEGIES.map((s) => (
                <Chip key={s.id} on={strategy === s.id} onClick={() => setStrategy(s.id)}>
                  {s.label}
                </Chip>
              ))}
            </Chips>
          )}
          <label className="flex items-center gap-3">
            <Muted className="w-40 whitespace-nowrap">Requests: {requests.toLocaleString()}</Muted>
            <input type="range" min={10} max={5000} step={10} value={requests} onChange={(e) => setRequests(Number(e.target.value))} className="min-h-[44px] flex-1" aria-label="Requests at expiry" />
          </label>
          <label className="flex items-center gap-3">
            <Muted className="w-40 whitespace-nowrap">TTL: {ttl}s</Muted>
            <input type="range" min={5} max={60} step={5} value={ttl} onChange={(e) => setTtl(Number(e.target.value))} className="min-h-[44px] flex-1" aria-label="Cache TTL" />
          </label>
          <pre className="m-0 text-[12.5px]">{SNIPPETS[mode === 'fix' ? strategy : 'none']}</pre>
        </div>
      }
      steps={steps}
      prediction={prediction}
      notice={{
        bullets: [
          'Expiry is a moment; every request in that moment misses at once.',
          'Lock + single refresh: one query, the rest wait a few ms. Stale-while-revalidate: nobody waits, one background query. Jittered TTL: the caches never die together.',
          `Peak load here: ${peak}% for ${requests.toLocaleString()} requests.`,
        ],
        takeaway: 'Expiry is a moment; 1,000 requests in that moment is a stampede. Serve stale, refresh once.',
        takeawayBn: 'মেয়াদ শেষ হওয়া একটা মুহূর্ত; সেই মুহূর্তে ১০০০ request মানেই stampede। পুরনোটা দাও, একবার refresh করো।',
        challenge: 'Drop requests to 10 with no protection. Is a stampede still a stampede?',
      }}
      render={(st) => <Shop st={st} />}
    />
  );
}

function Shop({ st }: { st: StampedeState }) {
  const dots = Math.min(60, Math.max(1, Math.round(st.requests / 20)));
  const toDb = st.served.fromDb;
  const total = Math.max(1, st.requests);
  const nDb = Math.round((dots * Math.min(toDb, total)) / total);
  const nWait = Math.round((dots * st.served.waiting) / total);
  const nStale = Math.round((dots * st.served.stale) / total);
  const nCache = Math.max(0, dots - nDb - nWait - nStale);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between">
        <Muted>t = {st.t}s</Muted>
        <Muted>DB queries: {st.dbQueries.toLocaleString()}</Muted>
      </div>
      <div className={`grid gap-2 ${st.caches.length > 1 ? 'grid-cols-5' : 'grid-cols-1'}`}>
        {st.caches.map((c) => (
          <div key={c.label} className={`rounded-xl border p-2 text-center text-[12.5px] ${c.status === 'fresh' ? 'border-accent bg-accent-soft/50 dark:bg-[#123a22]' : c.status === 'stale' ? 'border-warn bg-warn-soft dark:bg-[#2c2410]' : c.status === 'refreshing' ? 'border-warn' : 'border-danger bg-danger-soft dark:bg-[#3a1512]'}`}>
            <div className="font-semibold">{c.label}</div>
            <div>{c.status === 'fresh' ? `fresh · ${Math.max(0, c.expiresAt - st.t)}s` : c.status === 'stale' ? 'stale copy' : c.status === 'refreshing' ? 'refreshing…' : 'empty'}</div>
          </div>
        ))}
      </div>
      <div>
        <div className="mb-1 flex justify-between text-[12.5px]">
          <Muted>Database load</Muted>
          <span className={st.dbLoad >= 100 ? 'font-semibold text-danger' : st.dbLoad > 50 ? 'text-warn' : 'text-accent'}>{st.dbLoad}%{st.overloaded ? ' — overloaded' : ''} · ~{st.latencyMs}ms</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-[#2a2e38]">
          <div className={`h-full transition-all ${st.dbLoad >= 100 ? 'bg-danger' : st.dbLoad > 50 ? 'bg-warn' : 'bg-accent'}`} style={{ width: `${st.dbLoad}%` }} />
        </div>
      </div>
      <div>
        <Muted className="mb-1">Customers ({st.requests.toLocaleString()}, one dot ≈ {Math.round(st.requests / dots)})</Muted>
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: dots }, (_, i) => {
            const cls = i < nDb ? 'bg-danger' : i < nDb + nWait ? 'bg-warn' : i < nDb + nWait + nStale ? 'bg-warn/60' : i < nDb + nWait + nStale + nCache ? 'bg-accent' : 'bg-neutral-300 dark:bg-[#2a2e38]';
            return <span key={i} className={`inline-block h-3 w-3 rounded-full ${cls}`} />;
          })}
        </div>
        <Muted className="mt-1 text-[12px]">red = went to the database · amber = waiting / got the stale copy · green = read the cache</Muted>
      </div>
    </div>
  );
}
