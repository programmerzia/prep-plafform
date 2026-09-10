import type { SimStep } from '../kit/types';

/** JOIN vs EXISTS row builder. Same data as the legacy demo: Ziaur has order 10 (500, items 42, 7, 42) and order 11 (200, item 7). */
export interface Item { id: number; order_id: number; product_id: number }
export interface Order { id: number; customer_id: number; total: number }

export const ORDERS: Order[] = [
  { id: 10, customer_id: 1, total: 500 },
  { id: 11, customer_id: 1, total: 200 },
];
export const ITEMS: Item[] = [
  { id: 1, order_id: 10, product_id: 42 },
  { id: 2, order_id: 10, product_id: 7 },
  { id: 3, order_id: 10, product_id: 42 },
  { id: 4, order_id: 11, product_id: 7 },
];

export const MODES = [
  { id: 'join', label: 'JOIN order_items' },
  { id: 'exists', label: 'WHERE EXISTS (…)' },
] as const;
export type Mode = (typeof MODES)[number]['id'];

export const PRESETS = [
  { id: 'all', label: 'no product filter' },
  { id: '42', label: 'product_id = 42' },
  { id: '7', label: 'product_id = 7' },
] as const;

export interface Row { o: Order; i: Item | null }
export interface JoinState {
  rows: Row[];
  /** which order the engine is looking at */
  cursorOrder: number | null;
  cursorItem: number | null;
  sum: number | null;
  real: number;
  done: boolean;
}

const matches = (i: Item, o: Order, p: string) => i.order_id === o.id && (p === 'all' || i.product_id === Number(p));

export function realRevenue(preset: string): number {
  return ORDERS.filter((o) => ITEMS.some((i) => matches(i, o, preset))).reduce((s, o) => s + o.total, 0);
}

export function buildSteps(mode: Mode, preset: string): SimStep<JoinState>[] {
  const real = realRevenue(preset);
  const steps: SimStep<JoinState>[] = [
    { state: { rows: [], cursorOrder: null, cursorItem: null, sum: null, real, done: false }, en: 'The database starts building the row set. Predict the SUM first, then press Step.', bn: 'Database row বানানো শুরু করবে। আগে SUM অনুমান করো।' },
  ];
  let rows: Row[] = [];
  for (const o of ORDERS) {
    const hits = ITEMS.filter((i) => matches(i, o, preset));
    if (mode === 'join') {
      if (hits.length === 0) {
        steps.push({ state: { rows, cursorOrder: o.id, cursorItem: null, sum: null, real, done: false }, en: `Order ${o.id}: no item matches, so the JOIN drops it. No row.`, bn: `Order ${o.id}: কোনো item মেলেনি, JOIN row দেয়নি।` });
        continue;
      }
      for (const i of hits) {
        rows = [...rows, { o, i }];
        steps.push({
          state: { rows, cursorOrder: o.id, cursorItem: i.id, sum: null, real, done: false },
          en: `Order ${o.id} matches item ${i.id} (product ${i.product_id}) → the order row is copied once more, total ${o.total} again.`,
          bn: `Order ${o.id} item ${i.id}-এর সাথে মিলল → order-এর row আবার copy হলো, total ${o.total} আবার।`,
          tone: hits.length > 1 ? 'bad' : undefined,
        });
      }
    } else {
      if (hits.length === 0) {
        steps.push({ state: { rows, cursorOrder: o.id, cursorItem: null, sum: null, real, done: false }, en: `Order ${o.id}: EXISTS asks "any matching item?" — no. The order is skipped.`, bn: `Order ${o.id}: EXISTS জিজ্ঞেস করল "আছে?" — না। বাদ।` });
        continue;
      }
      rows = [...rows, { o, i: null }];
      steps.push({
        state: { rows, cursorOrder: o.id, cursorItem: hits[0].id, sum: null, real, done: false },
        en: `Order ${o.id}: EXISTS asks "any matching item?" — yes (stops at item ${hits[0].id}). One row, total ${o.total} once.`,
        bn: `Order ${o.id}: EXISTS জিজ্ঞেস করল "আছে?" — হ্যাঁ, প্রথমটাতেই থেমে গেল। একটাই row।`,
        tone: 'ok',
      });
    }
  }
  const sum = rows.reduce((s, r) => s + r.o.total, 0);
  const ok = sum === real;
  steps.push({
    state: { rows, cursorOrder: null, cursorItem: null, sum, real, done: true },
    en: ok
      ? `SUM(o.total) = ${sum}. Correct. Each order appears exactly once.`
      : `SUM(o.total) = ${sum}, real revenue ${real}. Wrong by ${sum - real}. The order row was copied once per matching item — that is fan-out. GROUP BY would not change this number.`,
    bn: ok ? `SUM = ${sum}। ঠিক আছে, প্রতিটা order একবারই।` : `SUM = ${sum}, আসল ${real}। ${sum - real} বেশি — এটাই fan-out। GROUP BY এটা ঠিক করে না।`,
    tone: ok ? 'ok' : 'bad',
  });
  return steps;
}

export function sumOf(mode: Mode, preset: string): number {
  const s = buildSteps(mode, preset);
  return s[s.length - 1].state.sum ?? 0;
}
