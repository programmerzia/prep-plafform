import { useMemo, useState } from 'react';
import { Chip, Chips, Muted } from '../ui/primitives';
import { SimShell } from './kit';
import { buildSteps, codeFor, finalShows, FIXES, MODES, type Fix, type Mode, type Options, type RaceState } from './logic/react-race';

export default function ReactRaceSimulator() {
  const [mode, setMode] = useState<Mode>('none');
  const [fix, setFix] = useState<Fix>('flag');
  const [latencyJa, setLatencyJa] = useState(3);
  const [latencyJav, setLatencyJav] = useState(1);
  const [strictMode, setStrictMode] = useState(false);
  const [missingDep, setMissingDep] = useState(false);
  const opts: Options = useMemo(() => ({ fix, latencyJa, latencyJav, strictMode, missingDep }), [fix, latencyJa, latencyJav, strictMode, missingDep]);
  const steps = useMemo(() => buildSteps(mode, opts), [mode, opts]);
  const shows = finalShows(mode, opts);
  const code = codeFor(mode, fix, missingDep);

  const prediction = useMemo(
    () => ({
      question: 'The query box says "jav". What does the results panel show when everything has arrived?',
      choices: [
        { id: 'results for "jav"', label: 'Results for "jav"' },
        { id: 'results for "ja"', label: 'Results for "ja"' },
        { id: 'nothing', label: 'Nothing' },
      ],
      correct: shows,
      actual: shows,
    }),
    [shows],
  );

  return (
    <SimShell<RaceState>
      id="react-race"
      title="Two coffees, the second arrives first"
      story="You type 'ja' then 'jav' in a search box. Two requests go out. The 'ja' results arrive LAST and overwrite 'jav'. An effect can be out of date by the time its response arrives; cleanup is how it says 'ignore me'."
      storyBn="Search box-এ 'ja' তারপর 'jav' লিখলে। দুটো request গেল। 'ja'-এর ফল সবার শেষে এসে 'jav'-এরটা মুছে দিল। Cleanup হলো effect-এর 'আমাকে উপেক্ষা করো' বলার উপায়।"
      modes={[...MODES]}
      mode={mode}
      onMode={(m) => setMode(m as Mode)}
      extras={
        <div className="flex flex-col gap-2">
          {mode === 'fix' && (
            <Chips>
              {FIXES.map((f) => (
                <Chip key={f.id} on={fix === f.id} onClick={() => setFix(f.id)}>{f.label}</Chip>
              ))}
            </Chips>
          )}
          <label className="flex items-center gap-3">
            <Muted className="w-44 whitespace-nowrap">"ja" latency: {latencyJa} ticks</Muted>
            <input type="range" min={1} max={5} value={latencyJa} onChange={(e) => setLatencyJa(Number(e.target.value))} className="min-h-[44px] flex-1" aria-label="Latency of the ja request" />
          </label>
          <label className="flex items-center gap-3">
            <Muted className="w-44 whitespace-nowrap">"jav" latency: {latencyJav} ticks</Muted>
            <input type="range" min={1} max={5} value={latencyJav} onChange={(e) => setLatencyJav(Number(e.target.value))} className="min-h-[44px] flex-1" aria-label="Latency of the jav request" />
          </label>
          <Chips>
            <Chip on={strictMode} onClick={() => setStrictMode(!strictMode)}>Strict Mode double-invoke</Chip>
            {fix !== 'rq' || mode === 'none' ? <Chip on={missingDep} onClick={() => setMissingDep(!missingDep)}>missing dependency</Chip> : null}
          </Chips>
        </div>
      }
      steps={steps}
      prediction={prediction}
      notice={{
        bullets: [
          'The response that arrives last wins the setState, not the one that was asked for last.',
          'Cleanup runs before the next effect and on unmount: flag it, abort it, or key the cache so the UI reads the current key.',
          'Strict Mode runs effects twice in dev on purpose. With correct cleanup it is harmless; without it, it exposes the bug early.',
        ],
        takeaway: "An effect can be out of date by the time its response arrives. Cleanup is how it says 'ignore me'.",
        takeawayBn: 'উত্তর আসতে আসতে effect পুরনো হয়ে যেতে পারে। Cleanup-ই তার "আমাকে উপেক্ষা করো" বলার উপায়।',
        challenge: 'Set both latencies to 1 with no cleanup. Is the code correct now, or just lucky?',
      }}
      render={(st) => <Panel st={st} code={code} />}
    />
  );
}

function Panel({ st, code }: { st: RaceState; code: string[] }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Muted>t = {st.t}</Muted>
        <div className="flex-1 rounded-xl border border-line px-3 py-2 font-mono text-[14px] dark:border-[#2a2e38]">
          🔍 {st.query}<span className="animate-pulse">|</span>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {st.requests.length === 0 && <Muted>No requests yet.</Muted>}
        {st.requests.map((r, i) => {
          const progress = r.status === 'flying' ? Math.min(100, Math.round((100 * (st.t - r.sentAt)) / (r.arrivesAt - r.sentAt))) : 100;
          const cls = r.status === 'arrived' || r.status === 'cached' ? 'bg-accent' : r.status === 'aborted' || r.status === 'ignored' ? 'bg-neutral-400' : 'bg-warn';
          return (
            <div key={i} className="flex items-center gap-2 text-[12.5px]">
              <span className="w-24 font-mono">"{r.q}"{r.run > 1 && st.requests.some((x) => x.q === r.q && x.run !== r.run) ? '′' : ''}</span>
              <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-[#2a2e38]">
                <div className={`h-full ${cls} transition-all`} style={{ width: `${progress}%` }} />
              </div>
              <span className={`w-28 ${r.status === 'aborted' || r.status === 'ignored' ? 'text-neutral-500' : r.status === 'flying' ? 'text-warn' : 'text-accent'}`}>
                {r.status === 'flying' ? `→ ${r.arrivesAt - st.t} tick${r.arrivesAt - st.t !== 1 ? 's' : ''}` : r.status === 'aborted' ? '✕ aborted' : r.status === 'ignored' ? '⊘ ignored' : r.status === 'cached' ? '⬚ cached by key' : '✓ arrived'}
              </span>
            </div>
          );
        })}
      </div>
      <div className={`rounded-xl border p-3 text-[13.5px] ${st.wrong ? 'border-danger bg-danger-soft dark:bg-[#3a1512]' : st.results ? 'border-accent bg-accent-soft/50 dark:bg-[#123a22]' : 'border-line dark:border-[#2a2e38]'}`}>
        <Muted>Results panel</Muted>
        <div className="font-semibold">{st.results ?? 'empty'}</div>
        {st.wrong && <div className="text-danger">✗ does not match the query "{st.query}"</div>}
      </div>
      <pre className="m-0 text-[12.5px]">
        {code.map((line, i) => (
          <div key={i} className={st.highlight.includes(i + 1) ? 'rounded bg-warn-soft dark:bg-[#2c2410]' : ''}>
            {line}
          </div>
        ))}
      </pre>
    </div>
  );
}
