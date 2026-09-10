import { useMemo, useState } from 'react';
import { Button, Chip, Chips, Muted } from '../ui/primitives';
import { SimShell } from './kit';
import { buildSteps, CAPACITIES, CODE_JS, CODE_PHP, DEFAULT_OPS, hitsOf, MODES, opLabel, SAMPLE_KEYS, type LruState, type Mode, type Op } from './logic/lru-cache';

export default function LruCacheSimulator() {
  const [mode, setMode] = useState<Mode>('fifo');
  const [cap, setCap] = useState('3');
  const [ops, setOps] = useState<Op[]>(DEFAULT_OPS);
  const [custom, setCustom] = useState('');
  const [showCode, setShowCode] = useState<'none' | 'js' | 'php'>('none');
  const [whyO1, setWhyO1] = useState(false);
  const capacity = Number(cap);
  const steps = useMemo(() => buildSteps(mode, capacity, ops), [mode, capacity, ops]);
  const { hits, gets } = hitsOf(mode, capacity, ops);
  let n = 0;
  const nextValue = () => String(++n + ops.length);

  const prediction = useMemo(() => {
    const alt = new Set([hits, Math.max(0, hits - 1), Math.min(gets, hits + 1), 0]);
    const choices = [...alt].slice(0, 3).map((h) => ({ id: String(h), label: `${h} of ${gets} hits` }));
    return { question: `${gets} gets in the script. How many will be hits?`, choices, correct: String(hits), actual: `${hits} of ${gets}` };
  }, [hits, gets]);

  const add = (op: Op) => setOps((o) => [...o, op]);

  return (
    <SimShell<LruState>
      id="lru-cache"
      title="A small shelf: the least-used item falls off"
      story="A shelf holds 3 books. Every time you read one you move it to the front. A 4th book pushes off the one at the back. That is an LRU cache: a hash map to find a book instantly, a linked list to remember the order."
      storyBn="তিন বইয়ের তাক। যেটা পড়ো সেটা সামনে রাখো। চতুর্থ বই এলে পেছনেরটা পড়ে যায়। এটাই LRU cache: খোঁজার জন্য hash map, order মনে রাখার জন্য linked list।"
      modes={[...MODES]}
      mode={mode}
      onMode={(m) => setMode(m as Mode)}
      presets={[...CAPACITIES]}
      preset={cap}
      onPreset={setCap}
      extras={
        <div className="flex flex-col gap-2">
          <Muted>Script ({ops.length} ops): {ops.map(opLabel).join(' · ')}</Muted>
          <Chips>
            {SAMPLE_KEYS.map((k) => (
              <Chip key={`g${k}`} onClick={() => add({ kind: 'get', key: k })}>get({k})</Chip>
            ))}
            {SAMPLE_KEYS.map((k) => (
              <Chip key={`s${k}`} onClick={() => add({ kind: 'set', key: k, value: nextValue() })}>set({k})</Chip>
            ))}
            <input
              className="min-h-[44px] w-24 rounded-xl border border-line bg-transparent px-3 text-[14px] dark:border-[#2a2e38]"
              placeholder="key"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              aria-label="Custom key"
            />
            <Chip disabled={!custom.trim()} onClick={() => { add({ kind: 'get', key: custom.trim() }); }}>get(custom)</Chip>
            <Chip disabled={!custom.trim()} onClick={() => { add({ kind: 'set', key: custom.trim(), value: nextValue() }); }}>set(custom)</Chip>
            <Button variant="ghost" onClick={() => setOps(DEFAULT_OPS)}>Reset script</Button>
            <Button variant="ghost" onClick={() => setOps([])}>Clear</Button>
          </Chips>
          <Chips>
            <Chip on={showCode === 'js'} onClick={() => setShowCode(showCode === 'js' ? 'none' : 'js')}>Show the code (JS Map)</Chip>
            <Chip on={showCode === 'php'} onClick={() => setShowCode(showCode === 'php' ? 'none' : 'php')}>Show the code (PHP)</Chip>
            <Chip on={whyO1} onClick={() => setWhyO1(!whyO1)}>Why O(1)?</Chip>
          </Chips>
          {showCode !== 'none' && <pre className="m-0 text-[12.5px]">{showCode === 'js' ? CODE_JS : CODE_PHP}</pre>}
          {whyO1 && <Muted>Two structures, two jobs: the map answers "where is key k?" in one step; the doubly-linked list moves a node to the front or drops the tail by re-pointing two neighbours. No scanning anywhere.</Muted>}
        </div>
      }
      steps={steps}
      prediction={prediction}
      notice={{
        bullets: [
          'The hash map gives O(1) lookup; the linked list gives O(1) re-ordering and eviction.',
          'FIFO forgets that you read something; LRU moves it to the front so the tail is always the least recently used.',
          'JS Map and PHP arrays keep insertion order, so delete + re-insert is the "move to front" trick.',
        ],
        takeaway: 'Hash map for the lookup, linked list for the order. Map in JS gives you both.',
        takeawayBn: 'খোঁজার জন্য hash map, order-এর জন্য linked list। JS-এর Map দুটোই দেয়।',
        challenge: 'Clear the script and reach a 60% hit rate with capacity 2.',
      }}
      render={(st) => <Shelf st={st} whyO1={whyO1} />}
    />
  );
}

function Shelf({ st, whyO1 }: { st: LruState; whyO1: boolean }) {
  const hl = (on: boolean) => (whyO1 && on ? 'ring-2 ring-accent' : '');
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-[13px]">
        <Muted>last op: <code>{st.lastOp || '—'}</code></Muted>
        <span><span className="text-accent">hits {st.hits}</span> · <span className="text-danger">misses {st.misses}</span></span>
      </div>
      <div className={`rounded-xl border border-line p-2 dark:border-[#2a2e38] ${hl(st.touched.list)}`}>
        <Muted className="mb-1">Shelf / linked list (front = most recent)</Muted>
        <div className="flex items-center gap-1 overflow-x-auto">
          <span className="text-[11px] text-neutral-500">head →</span>
          {st.list.length === 0 && <span className="text-neutral-400">empty</span>}
          {st.list.map((nd, i) => (
            <div key={nd.key} className="flex items-center gap-1">
              <div className={`min-w-[52px] rounded-lg border px-2 py-1 text-center text-[13px] ${i === 0 && st.touched.list ? 'border-accent bg-accent-soft dark:bg-[#123a22]' : 'border-line dark:border-[#2a2e38]'}`}>
                <div className="font-semibold">{nd.key}</div>
                <div className="text-[11px] text-neutral-500">{nd.value}</div>
              </div>
              {i < st.list.length - 1 && <span className="text-neutral-400">⇄</span>}
            </div>
          ))}
          <span className="text-[11px] text-neutral-500">← tail</span>
          {st.evicted && <span className="ml-2 rounded-lg bg-danger-soft px-2 py-1 text-[12px] text-danger dark:bg-[#3a1512]">✕ {st.evicted} fell off</span>}
        </div>
        {Array.from({ length: Math.max(0, st.capacity - st.list.length) }).length > 0 && <Muted className="mt-1 text-[12px]">{st.capacity - st.list.length} free slot{st.capacity - st.list.length > 1 ? 's' : ''}</Muted>}
      </div>
      <div className={`rounded-xl border border-line p-2 dark:border-[#2a2e38] ${hl(st.touched.map)}`}>
        <Muted className="mb-1">Hash map (key → node)</Muted>
        <div className="flex flex-wrap gap-1 font-mono text-[12.5px]">
          {st.list.length === 0 && <span className="text-neutral-400">{'{}'}</span>}
          {st.list.map((nd) => (
            <span key={nd.key} className="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-[#1f232b]">{nd.key} → node({nd.value})</span>
          ))}
        </div>
      </div>
    </div>
  );
}
