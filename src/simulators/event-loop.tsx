import { useState } from 'react';
import { Button, Chip, Chips, Muted } from '../ui/primitives';

/** Ported from legacy demoLoop. Same presets, same stepping rules, same wording. */
type Kind = 'sync' | 'micro' | 'macro';
interface Line { t: Kind; l: string }

const PRESETS: Record<string, { label: string; lines: [Kind, string][] }> = {
  a: { label: 'Basic', lines: [['sync', 'log(1)'], ['macro', 'setTimeout → log(2)'], ['micro', 'promise.then → log(3)'], ['sync', 'log(4)']] },
  b: { label: 'await', lines: [['sync', "log('a')"], ['micro', "after await → log('b')"], ['sync', "log('c')"]] },
  c: {
    label: 'Nested',
    lines: [
      ['macro', "setTimeout → log('T1') + queues micro log('M-in-T1')"],
      ['micro', "promise.then → log('M1') + queues macro log('T-in-M1')"],
      ['sync', "log('S')"],
    ],
  },
};

interface State {
  stack: string[];
  micro: string[];
  macro: string[];
  out: string[];
  script: Line[];
  note: string;
  done: boolean;
}

const logOf = (s: string) => s.replace(/^.*log\(([^)]*)\).*$/, '$1');

function build(key: string): State {
  return { stack: [], micro: [], macro: [], out: [], script: PRESETS[key].lines.map(([t, l]) => ({ t, l })), note: '', done: false };
}

function step(st: State): State {
  if (st.done) return st;
  // 1. run script synchronously: sync lines go to output, others enqueue
  if (st.script.length) {
    const [s, ...rest] = st.script;
    const next: State = { ...st, script: rest, stack: [s.l] };
    if (s.t === 'sync') next.out = [...st.out, logOf(s.l)];
    else if (s.t === 'micro') next.micro = [...st.micro, s.l];
    else next.macro = [...st.macro, s.l];
    next.note = s.t === 'sync' ? 'Synchronous: runs now.' : s.t === 'micro' ? 'Promise callback → microtask queue (VIP tray).' : 'Timer callback → macrotask queue (regular tickets).';
    return next;
  }
  // 2. drain microtasks
  if (st.micro.length) {
    const [m, ...rest] = st.micro;
    const macro = /queues macro/.test(m) ? [...st.macro, "setTimeout → log('T-in-M1')"] : st.macro;
    return { ...st, micro: rest, macro, stack: [m], out: [...st.out, logOf(m)], note: 'Stack empty → drain ALL microtasks before any timer.' };
  }
  // 3. one macrotask
  if (st.macro.length) {
    const [m, ...rest] = st.macro;
    const micro = /queues micro/.test(m) ? [...st.micro, "promise.then → log('M-in-T1')"] : st.micro;
    return { ...st, macro: rest, micro, stack: [m], out: [...st.out, logOf(m)], note: 'Microtasks empty → take ONE macrotask, then check microtasks again.' };
  }
  return { ...st, stack: [], done: true, note: 'Done. Compare the output with your prediction.' };
}

function Box({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <div className="min-w-[110px] flex-1">
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
  const [key, setKey] = useState('a');
  const [st, setSt] = useState<State>(() => build('a'));

  return (
    <div className="flex flex-col gap-2 text-[14px]">
      <Chips>
        {Object.entries(PRESETS).map(([k, p]) => (
          <Chip key={k} on={key === k} onClick={() => { setKey(k); setSt(build(k)); }}>
            {p.label}
          </Chip>
        ))}
      </Chips>
      <Muted>Script left to run:</Muted>
      <div className="min-h-[20px]">
        {st.script.length ? st.script.map((s, i) => <div key={i} className="text-[13px]"><code>{s.l}</code></div>) : <span className="text-xs text-neutral-400">— all lines executed —</span>}
      </div>
      <div className="flex gap-2">
        <Box title="Call stack" items={st.stack} tone="bg-neutral-100 dark:bg-[#1f232b]" />
        <Box title="Microtasks" items={st.micro} tone="bg-accent-soft dark:bg-[#12291b]" />
        <Box title="Macrotasks" items={st.macro} tone="bg-warn-soft dark:bg-[#2c2410]" />
      </div>
      <Muted>Console output</Muted>
      <pre className="m-0">{st.out.join('  ') || ' '}</pre>
      <div className="min-h-[24px]">{st.note || 'Predict the output first. Then press Step.'}</div>
      <div className="flex gap-2">
        <Button variant="primary" className="flex-1" disabled={st.done} onClick={() => setSt(step(st))}>Step</Button>
        <Button onClick={() => setSt(build(key))}>Reset</Button>
      </div>
    </div>
  );
}
