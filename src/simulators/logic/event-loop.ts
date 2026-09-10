import type { SimStep } from '../kit/types';

/** Event loop state machine. Ported from the legacy demo; now produces a full step list so the shell can drive it. */
export type Kind = 'sync' | 'micro' | 'macro';
export interface Line { t: Kind; l: string }

export interface LoopState {
  stack: string[];
  micro: string[];
  macro: string[];
  /** naive mode: one FIFO queue in the order things were queued (the wrong mental model) */
  fifo: string[];
  out: string[];
  script: Line[];
  done: boolean;
}

export const PRESETS: Record<string, { label: string; lines: [Kind, string][] }> = {
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

export const MODES = [
  { id: 'naive', label: 'Naive: one queue' },
  { id: 'real', label: 'Real: VIP tray first' },
] as const;
export type Mode = (typeof MODES)[number]['id'];

// Non-greedy on purpose: the legacy demo matched the LAST log() on a line.
const logOf = (s: string) => s.replace(/^.*?log\(([^)]*)\).*$/, '$1');

function initial(preset: string): LoopState {
  return { stack: [], micro: [], macro: [], fifo: [], out: [], script: PRESETS[preset].lines.map(([t, l]) => ({ t, l })), done: false };
}

/** One transition of the real engine. */
export function stepReal(st: LoopState): SimStep<LoopState> {
  if (st.script.length) {
    const [s, ...rest] = st.script;
    const next: LoopState = { ...st, script: rest, stack: [s.l] };
    if (s.t === 'sync') {
      next.out = [...st.out, logOf(s.l)];
      return { state: next, en: `Synchronous line runs now: ${logOf(s.l)} goes to the console.`, bn: 'Synchronous code সাথে সাথে চলে।' };
    }
    if (s.t === 'micro') {
      next.micro = [...st.micro, s.l];
      return { state: next, en: 'Promise callback → microtask queue (the VIP tray). It waits until the current code finishes.', bn: 'Promise-এর callback VIP tray-তে (microtask) জমা হলো।', tone: 'wait' };
    }
    next.macro = [...st.macro, s.l];
    return { state: next, en: 'Timer callback → macrotask queue (the regular tickets).', bn: 'Timer-এর callback সাধারণ টিকিটের লাইনে (macrotask) গেল।', tone: 'wait' };
  }
  if (st.micro.length) {
    const [m, ...rest] = st.micro;
    const macro = /queues macro/.test(m) ? [...st.macro, "setTimeout → log('T-in-M1')"] : st.macro;
    return {
      state: { ...st, micro: rest, macro, stack: [m], out: [...st.out, logOf(m)] },
      en: `Stack empty → drain ALL microtasks before any timer: ${logOf(m)}.`,
      bn: 'Stack খালি → আগে VIP tray পুরো খালি হয়, তারপর timer।',
      tone: 'ok',
    };
  }
  if (st.macro.length) {
    const [m, ...rest] = st.macro;
    const micro = /queues micro/.test(m) ? [...st.micro, "promise.then → log('M-in-T1')"] : st.micro;
    return {
      state: { ...st, macro: rest, micro, stack: [m], out: [...st.out, logOf(m)] },
      en: `Microtasks empty → take ONE macrotask, then check microtasks again: ${logOf(m)}.`,
      bn: 'VIP tray খালি → একটা মাত্র regular টিকিট, তারপর আবার VIP tray দেখা।',
      tone: 'ok',
    };
  }
  return { state: { ...st, stack: [], done: true }, en: 'Done. Compare the output with your prediction.', bn: 'শেষ। তোমার অনুমানের সাথে output মেলাও।' };
}

/** The wrong mental model: everything queued runs in the order it was queued, after the sync code. */
export function stepNaive(st: LoopState): SimStep<LoopState> {
  if (st.script.length) {
    const [s, ...rest] = st.script;
    const next: LoopState = { ...st, script: rest, stack: [s.l] };
    if (s.t === 'sync') {
      next.out = [...st.out, logOf(s.l)];
      return { state: next, en: `Synchronous line runs now: ${logOf(s.l)}.`, bn: 'Synchronous code সাথে সাথে চলে।' };
    }
    next.fifo = [...st.fifo, s.l];
    return { state: next, en: 'Callback goes to the back of ONE queue, first come first served (this is the guess many people make).', bn: 'Callback একটাই লাইনের পিছনে দাঁড়াল — আগে এলে আগে (এটা ভুল ধারণা)।', tone: 'wait' };
  }
  if (st.fifo.length) {
    const [m, ...rest] = st.fifo;
    let fifo = rest;
    if (/queues macro/.test(m)) fifo = [...fifo, "setTimeout → log('T-in-M1')"];
    if (/queues micro/.test(m)) fifo = [...fifo, "promise.then → log('M-in-T1')"];
    return { state: { ...st, fifo, stack: [m], out: [...st.out, logOf(m)] }, en: `Next in the single queue: ${logOf(m)}. Real JavaScript does NOT do this.`, bn: 'একটাই লাইন থেকে পরেরটা — আসল JavaScript এভাবে চলে না।', tone: 'bad' };
  }
  return { state: { ...st, stack: [], done: true }, en: 'Done. This is the wrong order — switch to "Real" to see why.', bn: 'শেষ। এই order ভুল — "Real" mode-এ দেখো কেন।', tone: 'bad' };
}

/** Full run: steps[0] is the initial state. */
export function buildSteps(mode: Mode, preset: string): SimStep<LoopState>[] {
  const stepFn = mode === 'real' ? stepReal : stepNaive;
  const steps: SimStep<LoopState>[] = [{ state: initial(preset), en: 'Predict the output first. Then press Step.', bn: 'আগে output অনুমান করো, তারপর Step চাপো।' }];
  let st = steps[0].state;
  for (let guard = 0; guard < 50 && !st.done; guard++) {
    const s = stepFn(st);
    steps.push(s);
    st = s.state;
  }
  return steps;
}

export function outputOf(mode: Mode, preset: string): string {
  const steps = buildSteps(mode, preset);
  return steps[steps.length - 1].state.out.join(' ');
}
