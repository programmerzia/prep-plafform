import type { SimStep } from '../kit/types';

/** lru-cache: a small shelf, the least-used item falls off. */
export const MODES = [
  { id: 'fifo', label: 'FIFO shelf (never re-order)' },
  { id: 'lru', label: 'LRU (read moves to front)' },
] as const;
export type Mode = (typeof MODES)[number]['id'];

export const CAPACITIES = [
  { id: '2', label: 'capacity 2' },
  { id: '3', label: 'capacity 3' },
  { id: '4', label: 'capacity 4' },
] as const;

export type Op = { kind: 'get'; key: string } | { kind: 'set'; key: string; value: string };

export const SAMPLE_KEYS = ['a', 'b', 'c', 'd'];

/** Default script: the classic interview trace. */
export const DEFAULT_OPS: Op[] = [
  { kind: 'set', key: 'a', value: '1' },
  { kind: 'set', key: 'b', value: '2' },
  { kind: 'get', key: 'a' },
  { kind: 'set', key: 'c', value: '3' },
  { kind: 'get', key: 'a' },
  { kind: 'get', key: 'b' },
  { kind: 'set', key: 'd', value: '4' },
  { kind: 'get', key: 'a' },
];

export interface Node { key: string; value: string }

export interface LruState {
  capacity: number;
  /** head first (most recently used) … tail last */
  list: Node[];
  hits: number;
  misses: number;
  evicted: string | null;
  lastOp: string;
  /** which structure did the work this step */
  touched: { map: boolean; list: boolean };
  done: boolean;
}

export function opLabel(op: Op): string {
  return op.kind === 'get' ? `get(${op.key})` : `set(${op.key}, ${op.value})`;
}

export function apply(st: LruState, op: Op, mode: Mode): { next: LruState; en: string; bn: string; tone?: 'ok' | 'bad' | 'wait' } {
  const list = st.list.map((n) => ({ ...n }));
  const idx = list.findIndex((n) => n.key === op.key);
  const next: LruState = { ...st, list, evicted: null, lastOp: opLabel(op), touched: { map: true, list: false } };
  if (op.kind === 'get') {
    if (idx === -1) {
      next.misses += 1;
      return { next, en: `get(${op.key}): the map has no "${op.key}" → miss. Nothing moves.`, bn: `get(${op.key}): map-এ নেই → miss।`, tone: 'bad' };
    }
    next.hits += 1;
    if (mode === 'lru') {
      const [node] = list.splice(idx, 1);
      list.unshift(node);
      next.touched.list = true;
      return { next, en: `get(${op.key}): map finds the node in O(1) → hit. Unlink it and re-link at the front: it was just used.`, bn: `get(${op.key}): map-এ পাওয়া গেল → hit। সামনে সরানো হলো।`, tone: 'ok' };
    }
    return { next, en: `get(${op.key}): hit, but a FIFO shelf does not remember that you used it. Order unchanged.`, bn: `get(${op.key}): hit, কিন্তু FIFO তাক মনে রাখে না। order একই।`, tone: 'wait' };
  }
  // set
  if (idx !== -1) {
    list[idx].value = op.value;
    if (mode === 'lru') {
      const [node] = list.splice(idx, 1);
      list.unshift(node);
      next.touched.list = true;
    }
    return { next, en: `set(${op.key}, ${op.value}): key exists, update the value${mode === 'lru' ? ' and move it to the front' : ''}.`, bn: `set(${op.key}): আগে থেকেই আছে, value বদলাল${mode === 'lru' ? ', সামনে গেল' : ''}।` };
  }
  list.unshift({ key: op.key, value: op.value });
  next.touched.list = true;
  if (list.length > st.capacity) {
    const gone = list.pop()!;
    next.evicted = gone.key;
    return { next, en: `set(${op.key}, ${op.value}): shelf is full (${st.capacity}). Put "${op.key}" at the front and drop the tail "${gone.key}"${mode === 'lru' ? ' — the least recently used' : ' — the oldest inserted, even if it was just read'}.`, bn: `set(${op.key}): তাক ভরা। সামনে রাখলাম, পেছনের "${gone.key}" পড়ে গেল।`, tone: mode === 'lru' ? 'ok' : 'wait' };
  }
  return { next, en: `set(${op.key}, ${op.value}): add a node at the front, store key → node in the map. ${list.length}/${st.capacity} used.`, bn: `set(${op.key}): সামনে নতুন node, map-এ key → node। ${list.length}/${st.capacity}।` };
}

export function buildSteps(mode: Mode, capacity: number, ops: Op[]): SimStep<LruState>[] {
  let st: LruState = { capacity, list: [], hits: 0, misses: 0, evicted: null, lastOp: '', touched: { map: false, list: false }, done: false };
  const steps: SimStep<LruState>[] = [
    { state: st, en: `A shelf of ${capacity}. ${ops.length} operations queued. Predict the hit count, then press Step.`, bn: `${capacity} বইয়ের তাক। ${ops.length}টা operation। hit কয়টা হবে অনুমান করো।` },
  ];
  for (const op of ops) {
    const r = apply(st, op, mode);
    st = r.next;
    steps.push({ state: st, en: r.en, bn: r.bn, tone: r.tone });
  }
  const gets = ops.filter((o) => o.kind === 'get').length;
  const rate = gets ? Math.round((100 * st.hits) / gets) : 0;
  steps.push({
    state: { ...st, done: true, touched: { map: false, list: false } },
    en: `Done: ${st.hits} hits, ${st.misses} misses (${rate}% hit rate). Shelf now: ${st.list.map((n) => n.key).join(' → ') || 'empty'} (front → back).`,
    bn: `শেষ: ${st.hits} hit, ${st.misses} miss (${rate}%)।`,
    tone: rate >= 60 ? 'ok' : 'wait',
  });
  return steps;
}

export function hitsOf(mode: Mode, capacity: number, ops: Op[]): { hits: number; gets: number } {
  const s = buildSteps(mode, capacity, ops);
  return { hits: s[s.length - 1].state.hits, gets: ops.filter((o) => o.kind === 'get').length };
}

export const CODE_JS = `class LRU {
  constructor(capacity) { this.cap = capacity; this.map = new Map(); } // Map keeps insertion order
  get(key) {
    if (!this.map.has(key)) return undefined;          // O(1) lookup
    const value = this.map.get(key);
    this.map.delete(key); this.map.set(key, value);    // re-insert = move to "front" (most recent)
    return value;
  }
  set(key, value) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.cap) this.map.delete(this.map.keys().next().value); // evict oldest
  }
}`;

export const CODE_PHP = `final class Lru {
    private array $items = [];                    // PHP arrays are ordered maps
    public function __construct(private int $cap) {}
    public function get(string $key): mixed {
        if (!array_key_exists($key, $this->items)) return null;
        $value = $this->items[$key];
        unset($this->items[$key]); $this->items[$key] = $value;   // move to the end = most recent
        return $value;
    }
    public function set(string $key, mixed $value): void {
        unset($this->items[$key]);
        $this->items[$key] = $value;
        if (count($this->items) > $this->cap) { reset($this->items); unset($this->items[key($this->items)]); }
    }
}`;
