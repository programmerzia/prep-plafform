import type { SimStep } from '../kit/types';

/** vue-reactivity: the spreadsheet cell that stopped updating. */
export const MODES = [
  { id: 'broken', label: 'Broken' },
  { id: 'fixed', label: 'Fixed' },
] as const;
export type Mode = (typeof MODES)[number]['id'];

export const CASES = [
  { id: 'destructure', label: 'const { count } = reactive(state)' },
  { id: 'copy', label: 'let count = state.count' },
  { id: 'array', label: 'items = newArray' },
  { id: 'value', label: '{{ count.value }} in template' },
  { id: 'watch', label: 'watch(state.count)' },
] as const;
export type Case = (typeof CASES)[number]['id'];

export const FIXES: Record<Case, { id: string; label: string }[]> = {
  destructure: [
    { id: 'toRefs', label: 'toRefs(state)' },
    { id: 'storeToRefs', label: 'storeToRefs(store) (Pinia)' },
    { id: 'computed', label: 'computed(() => state.count)' },
  ],
  copy: [
    { id: 'computed', label: 'computed(() => state.count)' },
    { id: 'toRef', label: 'toRef(state, "count")' },
  ],
  array: [
    { id: 'mutate', label: 'items.splice(0, n, ...newArray)' },
    { id: 'ref', label: 'const items = ref([]); items.value = newArray' },
  ],
  value: [{ id: 'unwrap', label: '{{ count }} (auto-unwrapped)' }],
  watch: [
    { id: 'getter', label: 'watch(() => state.count, cb)' },
    { id: 'toRef', label: 'watch(toRef(state, "count"), cb)' },
  ],
};

export interface VueState {
  count: number;
  items: string[];
  /** what the template shows for count / items */
  view: string;
  double: string;
  watchLog: string[];
  code: string[];
  /** 1-based lines that differ from the broken version */
  changed: number[];
  warning: string | null;
  done: boolean;
}

export function codeFor(mode: Mode, c: Case, fix: string): { code: string[]; changed: number[] } {
  const fixed = mode === 'fixed';
  switch (c) {
    case 'destructure':
      if (!fixed) return { code: ['const state = reactive({ count: 0 });', 'const { count } = state;          // plain number copied out', 'const double = computed(() => count * 2);', '// template: {{ count }} / {{ double }}'], changed: [] };
      if (fix === 'toRefs') return { code: ['const state = reactive({ count: 0 });', 'const { count } = toRefs(state);   // a ref that points INTO state', 'const double = computed(() => count.value * 2);', '// template: {{ count }} / {{ double }}'], changed: [2, 3] };
      if (fix === 'storeToRefs') return { code: ['const store = useCounterStore();   // Pinia', 'const { count } = storeToRefs(store); // refs, not copies', 'const double = computed(() => count.value * 2);', '// template: {{ count }} / {{ double }}'], changed: [1, 2, 3] };
      return { code: ['const state = reactive({ count: 0 });', 'const count = computed(() => state.count); // reads through the proxy', 'const double = computed(() => state.count * 2);', '// template: {{ count }} / {{ double }}'], changed: [2, 3] };
    case 'copy':
      if (!fixed) return { code: ['const state = reactive({ count: 0 });', 'let count = state.count;           // copies the VALUE 0', 'const double = computed(() => count * 2);', '// template: {{ count }} / {{ double }}'], changed: [] };
      if (fix === 'computed') return { code: ['const state = reactive({ count: 0 });', 'const count = computed(() => state.count);', 'const double = computed(() => state.count * 2);', '// template: {{ count }} / {{ double }}'], changed: [2, 3] };
      return { code: ['const state = reactive({ count: 0 });', "const count = toRef(state, 'count'); // live link to state.count", 'const double = computed(() => count.value * 2);', '// template: {{ count }} / {{ double }}'], changed: [2, 3] };
    case 'array':
      if (!fixed) return { code: ["let items = reactive(['Ahmed']);", 'function load(newArray) {', '  items = newArray;               // a NEW plain array; the template still holds the old proxy', '}', '// template: <li v-for="i in items">'], changed: [] };
      if (fix === 'mutate') return { code: ["const items = reactive(['Ahmed']);", 'function load(newArray) {', '  items.splice(0, items.length, ...newArray); // mutate the same proxy', '}', '// template: <li v-for="i in items">'], changed: [1, 3] };
      return { code: ["const items = ref(['Ahmed']);", 'function load(newArray) {', '  items.value = newArray;          // the ref wrapper stays, its value changes', '}', '// template: <li v-for="i in items">'], changed: [1, 3] };
    case 'value':
      if (!fixed) return { code: ['const count = ref(0);', '// template:', '<p>{{ count.value }}</p>            // top-level refs are already unwrapped'], changed: [] };
      return { code: ['const count = ref(0);', '// template:', '<p>{{ count }}</p>                  // Vue unwraps it for you'], changed: [3] };
    case 'watch':
      if (!fixed) return { code: ['const state = reactive({ count: 0 });', 'watch(state.count, (v) => log(`count is ${v}`)); // watches the NUMBER 0'], changed: [] };
      if (fix === 'getter') return { code: ['const state = reactive({ count: 0 });', 'watch(() => state.count, (v) => log(`count is ${v}`)); // a getter is a source'], changed: [2] };
      return { code: ['const state = reactive({ count: 0 });', "watch(toRef(state, 'count'), (v) => log(`count is ${v}`)); // a ref is a source"], changed: [2] };
  }
}

/** Does the template see changes, and does the watcher fire, in this scenario? */
export function behaviour(mode: Mode, c: Case): { viewReactive: boolean; watcherFires: boolean; warning: string | null } {
  const fixed = mode === 'fixed';
  switch (c) {
    case 'destructure':
    case 'copy':
      return { viewReactive: fixed, watcherFires: fixed, warning: fixed ? null : 'count is a plain number now: no proxy, no tracking.' };
    case 'array':
      return { viewReactive: fixed, watcherFires: fixed, warning: fixed ? null : 'the template still renders the OLD proxy; the new array is invisible to it.' };
    case 'value':
      return { viewReactive: true, watcherFires: true, warning: fixed ? null : "[Vue warn] count.value is undefined in the template: 'count' was already unwrapped." };
    case 'watch':
      return { viewReactive: true, watcherFires: fixed, warning: fixed ? null : '[Vue warn] Invalid watch source: 0. A watch source can only be a getter, a ref, a reactive object, or an array of these.' };
  }
}

export function buildSteps(mode: Mode, c: Case, fix: string): SimStep<VueState>[] {
  const { code, changed } = codeFor(mode, c, fix);
  const b = behaviour(mode, c);
  const isArray = c === 'array';
  const isValue = c === 'value';
  const render = (count: number, items: string[]): string => {
    if (isArray) return items.join(', ');
    if (isValue && mode === 'broken') return 'undefined';
    return String(count);
  };
  let st: VueState = { count: 0, items: ['Ahmed'], view: render(0, ['Ahmed']), double: isArray ? '—' : '0', watchLog: [], code, changed, warning: null, done: false };
  const steps: SimStep<VueState>[] = [
    {
      state: st,
      en: isArray ? 'The list shows one name. We will load a new list. Predict what the screen shows afterwards.' : c === 'watch' ? 'A watcher should log every change of count. We will click +1 twice. Predict how many lines it logs.' : 'The screen shows count. We will click +1 twice. Predict what the screen shows afterwards.',
      bn: isArray ? 'List-এ একটা নাম। নতুন list load করব। পরে স্ক্রিনে কী দেখাবে অনুমান করো।' : c === 'watch' ? 'Watcher-এর প্রতিটা বদল log করার কথা। দুবার +1 চাপব। কয় লাইন log হবে?' : 'স্ক্রিনে count। দুবার +1 চাপব। পরে স্ক্রিনে কী দেখাবে?',
    },
  ];
  const push = (next: VueState, en: string, bn: string, tone?: 'ok' | 'bad' | 'wait') => {
    st = next;
    steps.push({ state: next, en, bn, tone });
  };
  const clone = (): VueState => ({ ...st, items: [...st.items], watchLog: [...st.watchLog], code: [...st.code], changed: [...st.changed] });

  // mount
  let s = clone();
  s.warning = b.warning && isValue ? b.warning : null;
  push(s, isValue && mode === 'broken' ? `Mount: the template reads count.value on an already-unwrapped ref → "undefined". ${b.warning}` : `Mount: the template renders "${s.view}".${isArray ? '' : ' The cell B1 (double) shows ' + s.double + '.'}`, isValue && mode === 'broken' ? 'Mount: template-এ count.value পড়ল → undefined।' : `Mount: স্ক্রিনে "${s.view}"।`, isValue && mode === 'broken' ? 'bad' : undefined);

  if (isArray) {
    s = clone();
    const newList = ['Rahman', 'Islam'];
    s.items = newList;
    s.view = b.viewReactive ? render(0, newList) : st.view;
    s.warning = b.warning;
    push(s, b.viewReactive ? `load(['Rahman', 'Islam']) changes the same wrapper the template watches. The list re-renders: "${s.view}".` : `load(['Rahman', 'Islam']) replaces the variable with a plain array. The template never hears about it: still "${s.view}". ${b.warning}`, b.viewReactive ? 'Same wrapper বদলাল, list নতুন করে আঁকল।' : 'Variable-টা নতুন plain array হলো, template জানলই না।', b.viewReactive ? 'ok' : 'bad');
  } else {
    for (let i = 1; i <= 2; i++) {
      s = clone();
      s.count = i;
      if (b.viewReactive) {
        s.view = render(i, s.items);
        s.double = String(i * 2);
      }
      if (b.watcherFires) s.watchLog = [...s.watchLog, `count is ${i}`];
      if (!b.viewReactive || !b.watcherFires) s.warning = b.warning;
      const viewMsg = b.viewReactive ? `The screen updates to "${s.view}"${isValue ? '' : `, B1 (double) shows ${s.double}`}.` : `The source is ${i}, but the screen still shows "${s.view}" and B1 still ${s.double}: the copy is not connected.`;
      const watchMsg = c === 'watch' ? (b.watcherFires ? ` Watcher logs "count is ${i}".` : ' The watcher stays silent: it was given a number, not a source.') : '';
      push(s, `Click +1: state.count = ${i}. ${viewMsg}${watchMsg}`, b.viewReactive ? `+1 চাপলে: count = ${i}, স্ক্রিন "${s.view}"।` : `+1 চাপলে: source ${i}, কিন্তু স্ক্রিনে এখনো "${s.view}"।`, b.viewReactive && (c !== 'watch' || b.watcherFires) ? 'ok' : 'bad');
    }
  }

  const final = clone();
  final.done = true;
  const ok = c === 'watch' ? b.watcherFires : b.viewReactive && !(isValue && mode === 'broken');
  push(
    final,
    ok ? `End: the wrapper carried every change. Screen "${final.view}"${c === 'watch' ? `, watcher logged ${final.watchLog.length} times` : ''}.` : c === 'watch' ? 'End: the screen updated but the watcher logged nothing. watch() needs a getter or a ref, not a value.' : `End: screen "${final.view}" while the real value is ${isArray ? final.items.join(', ') : final.count}. Reactivity lives in the wrapper, not the value.`,
    ok ? 'শেষ: wrapper প্রতিটা বদল বয়ে আনল।' : 'শেষ: reactivity থাকে wrapper-এ, value-তে না।',
    ok ? 'ok' : 'bad',
  );
  return steps;
}

export function finalView(mode: Mode, c: Case, fix: string): { view: string; logs: number } {
  const s = buildSteps(mode, c, fix);
  const st = s[s.length - 1].state;
  return { view: st.view, logs: st.watchLog.length };
}
