import { useMemo, useState } from 'react';
import { Chip, Chips, Muted } from '../ui/primitives';
import { SimShell } from './kit';
import { buildSteps, laravelJob, MODES, ON_ERROR, PRESETS, summary, TICKS, type Mode, type OnError, type Options, type Preset, type QueueState } from './logic/queue-backoff';

export default function QueueBackoffSimulator() {
  const [mode, setMode] = useState<Mode>('none');
  const [preset, setPreset] = useState<Preset>('poison');
  const [workers, setWorkers] = useState(1);
  const [failureRate, setFailureRate] = useState(30);
  const [idempotent, setIdempotent] = useState(true);
  const [onError, setOnError] = useState<OnError>('release');
  const opts: Options = useMemo(() => ({ workers, failureRate, idempotent, onError }), [workers, failureRate, idempotent, onError]);
  const steps = useMemo(() => buildSteps(mode, preset, opts), [mode, preset, opts]);
  const sum = summary(mode, preset, opts);

  const prediction = useMemo(
    () => ({
      question: `6 tickets, ${workers} cook${workers > 1 ? 's' : ''}. How many are done after ${TICKS} seconds?`,
      choices: [
        { id: '6', label: 'All 6' },
        { id: '5', label: '5 (one gives up)' },
        { id: '0', label: 'None' },
        { id: 'other', label: 'Somewhere in between' },
      ],
      correct: sum.done === 6 ? '6' : sum.done === 5 ? '5' : sum.done === 0 ? '0' : 'other',
      actual: `${sum.done} done, ${sum.dead} dead-lettered, ${sum.attempts} attempts`,
    }),
    [workers, sum],
  );

  return (
    <SimShell<QueueState>
      id="queue-backoff"
      title="Re-cooking a failed dish, but not forever"
      story="A kitchen ticket rail. A dish fails (out of stock). Re-try later; wait longer each time; after 3 tries the ticket goes to the manager's tray (the dead-letter queue). Retrying immediately and forever means one bad ticket blocks the whole kitchen."
      storyBn="রান্নাঘরের টিকিট রেল। একটা dish ব্যর্থ হলে পরে আবার চেষ্টা, প্রতিবার একটু বেশি অপেক্ষা, ৩ বারের পরে manager-এর tray-তে (dead-letter)। সাথে সাথে চিরকাল retry করলে একটা খারাপ টিকিটই পুরো kitchen আটকে দেয়।"
      modes={[...MODES]}
      mode={mode}
      onMode={(m) => setMode(m as Mode)}
      presets={[...PRESETS]}
      preset={preset}
      onPreset={(p) => setPreset(p as Preset)}
      extras={
        <div className="flex flex-col gap-2">
          <Chips>
            {[1, 2, 4].map((w) => (
              <Chip key={w} on={workers === w} onClick={() => setWorkers(w)}>{w} worker{w > 1 ? 's' : ''}</Chip>
            ))}
            {mode === 'fix' && ON_ERROR.map((o) => (
              <Chip key={o.id} on={onError === o.id} onClick={() => setOnError(o.id)}>{o.label}</Chip>
            ))}
            <Chip on={!idempotent} onClick={() => setIdempotent(!idempotent)}>job not idempotent</Chip>
          </Chips>
          {preset === 'normal' && (
            <label className="flex items-center gap-3">
              <Muted className="w-40 whitespace-nowrap">Failure rate: {failureRate}%</Muted>
              <input type="range" min={0} max={90} step={10} value={failureRate} onChange={(e) => setFailureRate(Number(e.target.value))} className="min-h-[44px] flex-1" aria-label="Failure rate" />
            </label>
          )}
          <pre className="m-0 text-[12.5px]">{laravelJob(mode, onError)}</pre>
        </div>
      }
      steps={steps}
      prediction={prediction}
      notice={{
        bullets: [
          'Immediate retries put the failing ticket back at the front: it hammers the failing service and everyone behind it starves.',
          'Exponential backoff with jitter spreads retries out; a max attempt count moves the ticket to failed_jobs on purpose, where a human can look.',
          'Every attempt runs the side effect again. Make the job safe to run twice, or the retry sends the invoice twice.',
        ],
        takeaway: 'Retry with growing gaps, give up on purpose, and make the job safe to run twice.',
        takeawayBn: 'বাড়তে থাকা ফাঁক দিয়ে retry করো, ইচ্ছে করেই থামো, আর job-টা দুবার চললেও যেন নিরাপদ থাকে।',
        challenge: 'Switch on "job not idempotent" with the normal preset at 60% failure and count the duplicate side effects.',
      }}
      render={(st) => <Rail st={st} idempotent={idempotent} />}
    />
  );
}

function Rail({ st, idempotent }: { st: QueueState; idempotent: boolean }) {
  const maxBar = 8;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-4 gap-2 text-center text-[12.5px]">
        <Stat label="t" value={`${st.t}s`} />
        <Stat label="done" value={String(st.done)} tone="ok" />
        <Stat label="dead-letter" value={String(st.dead)} tone={st.dead ? 'warn' : undefined} />
        <Stat label="attempts" value={String(st.attemptsTotal)} />
      </div>
      <div className="flex flex-col gap-1">
        {st.jobs.map((j) => {
          const running = st.running.includes(j.id);
          const cls = j.status === 'done' ? 'border-accent bg-accent-soft/50 dark:bg-[#123a22]' : j.status === 'dead' ? 'border-danger bg-danger-soft dark:bg-[#3a1512]' : j.status === 'waiting' ? 'border-warn bg-warn-soft/60 dark:bg-[#2c2410]' : running ? 'border-warn' : 'border-line dark:border-[#2a2e38]';
          return (
            <div key={j.id} className={`flex items-center gap-2 rounded-lg border px-2 py-1 text-[12.5px] ${cls}`}>
              <span className="w-28 truncate font-medium">{j.poison ? '☠ ' : ''}{j.name}</span>
              <span className="w-20 text-neutral-500">
                {j.status === 'done' ? '✓ done' : j.status === 'dead' ? '✕ tray' : j.status === 'waiting' ? `retry in ${Math.max(0, j.nextAt - st.t)}s` : running ? '🍳 cooking' : 'queued'}
              </span>
              <span className="w-16 text-neutral-500">try {j.attempts}</span>
              <div className="flex flex-1 items-center gap-0.5">
                {j.backoffs.map((b, i) => (
                  <span key={i} className="inline-block h-2 rounded-sm bg-warn" style={{ width: `${Math.min(100, (b / maxBar) * 40)}%` }} title={`${b}s`} />
                ))}
              </div>
              {!idempotent && j.sideEffects > 1 && <span className="text-danger">×{j.sideEffects} sent</span>}
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-[12.5px]">
        <Stat label="throughput" value={`${st.throughput}/10s`} />
        <Stat label="avg wait" value={`${st.avgWait}s`} />
        <Stat label="workers" value={String(st.workers)} />
      </div>
      {st.starved && <div className="rounded-xl bg-danger-soft px-3 py-2 text-[12.5px] text-danger dark:bg-[#3a1512]">Other tickets are starving behind the one that keeps failing.</div>}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'warn' }) {
  return (
    <div className="rounded-xl border border-line p-2 dark:border-[#2a2e38]">
      <Muted>{label}</Muted>
      <div className={`text-lg font-semibold ${tone === 'ok' ? 'text-accent' : tone === 'warn' ? 'text-warn' : ''}`}>{value}</div>
    </div>
  );
}
