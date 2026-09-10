import { useMemo, useState } from 'react';
import { Muted } from '../ui/primitives';
import { SimShell } from './kit';
import { buildSteps, MODES, PRESETS, outputOf, type LoopState, type Mode } from './logic/event-loop';

function Box({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <div className="min-w-[100px] flex-1">
      <Muted className="mb-1">{title}</Muted>
      <div className={`min-h-[64px] rounded-xl border border-dashed border-line p-1.5 dark:border-[#2a2e38] ${tone}`}>
        {items.length ? (
          items.map((i, k) => (
            <div key={k} className="my-1 rounded-md bg-white px-1.5 py-1 text-[12.5px] dark:bg-[#0f1115]">
              <code className="whitespace-normal break-words">{i}</code>
            </div>
          ))
        ) : (
          <span className="text-xs text-neutral-400">empty</span>
        )}
      </div>
    </div>
  );
}

export default function EventLoopSimulator() {
  const [mode, setMode] = useState<Mode>('real');
  const [preset, setPreset] = useState('a');
  const steps = useMemo(() => buildSteps(mode, preset), [mode, preset]);
  const actual = outputOf(mode, preset);
  const other = outputOf(mode === 'real' ? 'naive' : 'real', preset);

  const prediction = useMemo(() => {
    const choices = [{ id: 'real', label: outputOf('real', preset) }];
    const naive = outputOf('naive', preset);
    if (naive !== choices[0].label) choices.push({ id: 'naive', label: naive });
    const scriptOrder = PRESETS[preset].lines.map(([, l]) => l.replace(/^.*?log\(([^)]*)\).*$/, '$1')).join(' ');
    if (!choices.some((c) => c.label === scriptOrder)) choices.push({ id: 'script', label: scriptOrder });
    return { question: 'Which order will the console show?', choices, correct: mode === 'real' ? 'real' : 'naive', actual };
  }, [preset, mode, actual]);

  return (
    <SimShell<LoopState>
      id="event-loop"
      title="A restaurant with one chef"
      story="The chef (the single thread) finishes the dish in hand no matter what. Then he clears the VIP tray completely (promises). Only then does he take the next regular ticket (setTimeout)."
      storyBn="একজন chef (একটাই thread): হাতের রান্না আগে শেষ, তারপর VIP tray (promise) পুরো খালি, তারপর একটা সাধারণ টিকিট (setTimeout)।"
      modes={[...MODES]}
      mode={mode}
      onMode={(m) => setMode(m as Mode)}
      presets={Object.entries(PRESETS).map(([id, p]) => ({ id, label: p.label }))}
      preset={preset}
      onPreset={setPreset}
      steps={steps}
      prediction={prediction}
      notice={{
        bullets: [
          'All synchronous code runs to the end before any callback.',
          'Every microtask runs before the next macrotask, even one queued later.',
          `Naive single queue would print "${mode === 'real' ? other : actual}"; the real engine prints "${mode === 'real' ? actual : other}".`,
        ],
        takeaway: 'setTimeout 0 is never "now": promises always jump the queue.',
        takeawayBn: 'setTimeout 0 কখনো "এখনই" না — promise সবসময় লাইন টপকে যায়।',
        challenge: 'Pick "Nested" and predict where M-in-T1 lands before pressing Step.',
      }}
      render={(st) => (
        <div className="flex flex-col gap-2">
          <Muted>Script left to run:</Muted>
          <div className="min-h-[20px]">
            {st.script.length ? st.script.map((s, i) => <div key={i} className="text-[13px]"><code>{s.l}</code></div>) : <span className="text-xs text-neutral-400">— all lines executed —</span>}
          </div>
          <div className="flex gap-2">
            <Box title="Call stack" items={st.stack} tone="bg-neutral-100 dark:bg-[#1f232b]" />
            {mode === 'real' ? (
              <>
                <Box title="Microtasks (VIP tray)" items={st.micro} tone="bg-accent-soft dark:bg-[#12291b]" />
                <Box title="Macrotasks (tickets)" items={st.macro} tone="bg-warn-soft dark:bg-[#2c2410]" />
              </>
            ) : (
              <Box title="One queue (naive)" items={st.fifo} tone="bg-danger-soft dark:bg-[#3a1512]" />
            )}
          </div>
          <Muted>Console output</Muted>
          <pre className="m-0">{st.out.join('  ') || ' '}</pre>
        </div>
      )}
    />
  );
}
