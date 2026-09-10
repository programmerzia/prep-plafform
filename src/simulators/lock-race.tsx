import { useMemo, useState } from 'react';
import { Chip, Chips, Muted } from '../ui/primitives';
import { SimShell } from './kit';
import { buildSteps, FIXES, MODES, PRESETS, phasesFor, ticketsSold, type Fix, type Mode, type RaceState } from './logic/lock-race';

export default function LockRaceSimulator() {
  const [mode, setMode] = useState<Mode>('none');
  const [preset, setPreset] = useState<string>('2x1');
  const [fix, setFix] = useState<Fix>('forUpdate');
  const [delay, setDelay] = useState(0);
  const steps = useMemo(() => buildSteps(mode, preset, fix, delay), [mode, preset, fix, delay]);
  const seats = preset === '3x2' ? 2 : 1;
  const users = preset === '3x2' ? 3 : 2;
  const sold = ticketsSold(mode, preset, fix, delay);
  const phases = phasesFor(mode, fix);

  const prediction = useMemo(
    () => ({
      question: `${users} people, ${seats} seat${seats > 1 ? 's' : ''}. How many tickets get sold?`,
      choices: [
        { id: String(seats), label: `${seats} (correct number)` },
        { id: String(users), label: `${users} (everyone)` },
        { id: '0', label: '0 (nobody)' },
      ],
      correct: String(sold),
      actual: `${sold} ticket${sold !== 1 ? 's' : ''}`,
    }),
    [users, seats, sold],
  );

  return (
    <SimShell<RaceState>
      id="lock-race"
      title="Two people, the last seat"
      story="A bus has 1 seat left. Ziaur and Arafat both tap 'Book' in the same second. Each one reads 'seats = 1', checks it is more than zero, and writes seats - 1. Whether the bus ends up oversold depends on what happens between the read and the write."
      storyBn="বাসে ১টা সিট বাকি। জিয়াউর আর আরাফাত একই সেকেন্ডে 'Book' চাপল। পড়া আর লেখার মাঝখানে কী হয় তার ওপর সব নির্ভর করে।"
      modes={[...MODES]}
      mode={mode}
      onMode={(m) => setMode(m as Mode)}
      presets={[...PRESETS]}
      preset={preset}
      onPreset={setPreset}
      extras={
        <div className="flex flex-col gap-2">
          {mode === 'fix' && (
            <Chips>
              {FIXES.map((f) => (
                <Chip key={f.id} on={fix === f.id} onClick={() => setFix(f.id)}>
                  {f.label}
                </Chip>
              ))}
            </Chips>
          )}
          <label className="flex items-center gap-3">
            <Muted className="whitespace-nowrap">Delay between taps: {delay === 0 ? 'same second' : `${delay} step${delay > 1 ? 's' : ''}`}</Muted>
            <input type="range" min={0} max={4} step={1} value={delay} onChange={(e) => setDelay(Number(e.target.value))} className="min-h-[44px] flex-1" aria-label="Delay between users" />
          </label>
        </div>
      }
      steps={steps}
      prediction={prediction}
      notice={{
        bullets: [
          'A transaction is not a lock. Reading then writing without a lock is a race.',
          'FOR UPDATE makes the second reader wait; atomic UPDATE … WHERE seats > 0 lets the database decide in one statement; a version column detects the conflict and retries.',
          'The race only exists in the overlap window: slide the delay to 4 and even "No lock" looks fine, which is why it passes tests and fails at launch.',
        ],
        takeaway: 'Read-then-write without a lock is a race. Lock the row, update atomically, or check a version.',
        takeawayBn: 'Lock ছাড়া পড়ে-তারপর-লেখা মানেই race। Row lock করো, এক statement-এ update করো, বা version মেলাও।',
        challenge: 'Pick "3 users, 2 seats" with the version column and count how many retries happen.',
      }}
      render={(st) => (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <Muted>seats</Muted>
              <div className={`text-3xl font-semibold ${st.seats < 0 ? 'text-danger' : st.seats === 0 ? 'text-accent' : ''}`}>{st.seats}</div>
            </div>
            <div className="text-right">
              <Muted>tickets</Muted>
              <div className={`text-3xl font-semibold ${st.tickets > seats ? 'text-danger' : ''}`}>{st.tickets}</div>
            </div>
            {st.lockHolder && <div className="rounded-xl bg-warn-soft px-3 py-2 text-[13px] dark:bg-[#2c2410]">🔒 lock: {st.lockHolder}</div>}
          </div>
          <div className={`grid gap-2 ${st.lanes.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {st.lanes.map((l) => (
              <div key={l.name} className={`rounded-xl border p-2 text-[13px] ${laneTone(l.status)}`}>
                <div className="mb-1 flex items-center justify-between font-semibold">
                  <span>{l.name}</span>
                  <span>{l.status === 'waiting' ? '🔒 waiting…' : l.status === 'ticket' ? '🎟 ticket' : l.status === 'refused' ? '✕ refused' : l.status === 'retry' ? '↻ retry' : l.status === 'idle' ? 'tapping…' : ''}</span>
                </div>
                <ol className="m-0 list-none p-0">
                  {phases.map((p, i) => (
                    <li key={p} className={`rounded px-1.5 py-0.5 ${i === l.phaseIndex ? 'bg-white font-semibold dark:bg-[#0f1115]' : i < l.phaseIndex ? 'opacity-60' : 'opacity-40'}`}>
                      {i < l.phaseIndex ? '✓ ' : i === l.phaseIndex ? '▸ ' : '· '}
                      {p === 'READ' && l.read !== null && i <= l.phaseIndex ? `READ seats = ${l.read}` : p === 'WRITE' ? 'WRITE seats − 1' : p === 'CHECK' ? 'CHECK > 0' : p}
                    </li>
                  ))}
                </ol>
                {l.attempts > 0 && <Muted>retries: {l.attempts}</Muted>}
              </div>
            ))}
          </div>
          <pre className="m-0 text-[12.5px]">{st.sql || '-- SQL of the current step appears here'}</pre>
        </div>
      )}
    />
  );
}

function laneTone(s: string) {
  if (s === 'ticket') return 'border-accent bg-accent-soft/50 dark:bg-[#123a22]';
  if (s === 'refused') return 'border-line bg-neutral-50 dark:border-[#2a2e38] dark:bg-[#1f232b]';
  if (s === 'waiting' || s === 'retry') return 'border-warn bg-warn-soft dark:bg-[#2c2410]';
  return 'border-line dark:border-[#2a2e38]';
}
