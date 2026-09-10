import type { SimStep } from '../kit/types';

/** btree-walk: finding a name in a sorted phone book vs a pile of loose pages. */
export const MODES = [
  { id: 'scan', label: 'No index: loose pages' },
  { id: 'index', label: 'Index: sorted book' },
] as const;
export type Mode = (typeof MODES)[number]['id'];

export const PRESETS = [
  { id: '16', label: '16 rows' },
  { id: '256', label: '256 rows' },
  { id: '4096', label: '4,096 rows' },
  { id: '1000000', label: '1,000,000 rows' },
] as const;

export type Tab = 'single' | 'composite';
export type Query = 'eq' | 'prefix' | 'suffix' | 'number' | 'both' | 'created_only';

export const QUERIES: Record<Tab, { id: Query; label: string; sql: (v: string) => string }[]> = {
  single: [
    { id: 'eq', label: "= 'Rahman'", sql: (v) => `WHERE surname = '${v}'` },
    { id: 'prefix', label: "LIKE 'Rah%'", sql: (v) => `WHERE surname LIKE '${v.slice(0, 3)}%'` },
    { id: 'suffix', label: "LIKE '%man'", sql: (v) => `WHERE surname LIKE '%${v.slice(-3)}'` },
    { id: 'number', label: 'compare as number', sql: () => 'WHERE surname = 12345' },
  ],
  composite: [
    { id: 'both', label: 'customer_id AND created_at', sql: () => "WHERE customer_id = 42 AND created_at > '2026-01-01'" },
    { id: 'created_only', label: 'created_at only', sql: () => "WHERE created_at > '2026-01-01'" },
  ],
};

export const SAMPLE_NAMES = ['Rahman', 'Ahmed', 'Islam', 'Hossain', 'Zaman'];

/** Why the index could not be used, or null when it can. */
export function fullScanReason(mode: Mode, tab: Tab, query: Query): string | null {
  if (mode === 'scan') return 'There is no index: every page must be checked.';
  if (tab === 'single') {
    if (query === 'suffix') return "The book is sorted by the START of the name. LIKE '%man' needs the end, so every page is read.";
    if (query === 'number') return 'Comparing a text column to a number casts every row first. The cast throws the sorted book away.';
    return null;
  }
  if (query === 'created_only') return 'The composite index is sorted by customer_id first. Without it, created_at values are scattered: full scan.';
  return null;
}

export interface WalkState {
  n: number;
  rowsChecked: number;
  steps: number;
  /** index path boxes lit so far: root, branch, leaf(s), row */
  path: string[];
  /** the sorted position of the target row (0-based) */
  target: number;
  found: boolean;
  done: boolean;
  scanning: boolean;
  reason: string | null;
  /** counters to compare after the run */
  compare: { scan: number; index: number };
}

export function comparisons(n: number): number {
  return Math.max(1, Math.ceil(Math.log2(n)));
}

/** Deterministic sorted position for a name in a table of n rows. */
export function targetPosition(name: string, n: number): number {
  const first = (name.toLowerCase().charCodeAt(0) || 97) - 97; // a=0 .. z=25
  return Math.min(n - 1, Math.floor((first / 26) * n));
}

const fmt = (x: number) => x.toLocaleString('en-US');

export function buildSteps(mode: Mode, preset: string, tab: Tab, query: Query, name = 'Rahman'): SimStep<WalkState>[] {
  const n = Number(preset);
  const target = targetPosition(name, n);
  const reason = fullScanReason(mode, tab, query);
  const idxSteps = comparisons(n) + (query === 'prefix' ? 3 : 0);
  const compare = { scan: n, index: idxSteps };
  const base: WalkState = { n, rowsChecked: 0, steps: 0, path: [], target, found: false, done: false, scanning: !!reason, reason, compare };
  const steps: SimStep<WalkState>[] = [
    { state: base, en: `Find "${name}" among ${fmt(n)} rows. Predict how many rows get checked, then press Step.`, bn: `${fmt(n)} row-এর মধ্যে "${name}" খুঁজতে হবে। আগে অনুমান করো।` },
  ];

  if (reason) {
    // Full scan: check every row in up to 12 chunks.
    const chunks = Math.min(12, n);
    let checked = 0;
    steps.push({ state: { ...base, scanning: true }, en: reason, bn: 'Index কাজে লাগানো গেল না — প্রতিটা পাতা দেখতে হবে।', tone: 'bad' });
    for (let c = 1; c <= chunks; c++) {
      checked = Math.round((c / chunks) * n);
      const passedTarget = checked > target;
      steps.push({
        state: { ...base, scanning: true, rowsChecked: checked, steps: checked, found: passedTarget },
        en: passedTarget && checked - Math.round(((c - 1) / chunks) * n) > 0 && Math.round(((c - 1) / chunks) * n) <= target
          ? `Row ${fmt(target + 1)} matches, but the scan cannot stop: there might be more matches. ${fmt(checked)} of ${fmt(n)} checked.`
          : `Checking pages one by one… ${fmt(checked)} of ${fmt(n)} rows checked.`,
        bn: `এক এক করে পাতা দেখা হচ্ছে… ${fmt(checked)} / ${fmt(n)}।`,
        tone: 'bad',
      });
    }
    steps.push({
      state: { ...base, scanning: true, rowsChecked: n, steps: n, found: true, done: true },
      en: `Done: ${fmt(n)} rows checked to find one name. With an index it would take about ${idxSteps} steps.`,
      bn: `শেষ: একটা নাম পেতে ${fmt(n)} row দেখতে হলো। Index থাকলে ~${idxSteps} ধাপ।`,
      tone: 'bad',
    });
    return steps;
  }

  // Index walk: root → branch → leaf → row (plus a short leaf walk for a prefix range)
  const levels = ['root', 'branch', 'leaf'];
  const perLevel = Math.ceil(comparisons(n) / 3);
  let count = 0;
  for (const level of levels) {
    count = Math.min(comparisons(n), count + perLevel);
    const path = levels.slice(0, levels.indexOf(level) + 1);
    steps.push({
      state: { ...base, path, steps: count, rowsChecked: 0 },
      en:
        level === 'root'
          ? `Open the book in the middle (root page): "${name}" is ${target < n / 2 ? 'before' : 'after'} this point. ${count} comparison${count > 1 ? 's' : ''} so far.`
          : level === 'branch'
            ? `Flip to the section (branch page) that covers "${name.slice(0, 2)}…". ${count} comparisons so far.`
            : `Land on the leaf page that holds "${name}". ${count} comparisons so far.`,
      bn: level === 'root' ? 'বইয়ের মাঝখানে খোলো (root page)।' : level === 'branch' ? 'সঠিক section-এ যাও (branch page)।' : 'নামটা যে পাতায় আছে সেখানে (leaf page)।',
      tone: 'ok',
    });
  }
  if (query === 'prefix') {
    for (let k = 1; k <= 3; k++) {
      steps.push({
        state: { ...base, path: [...levels, ...Array(k).fill('leaf')], steps: comparisons(n) + k, rowsChecked: k },
        en: `LIKE '${name.slice(0, 3)}%' is a range: walk the next leaf page (${k} of 3). Names starting with "${name.slice(0, 3)}" sit next to each other.`,
        bn: `'${name.slice(0, 3)}%' একটা range: পাশের leaf page-গুলো হাঁটো (${k}/3)।`,
        tone: 'ok',
      });
    }
  }
  steps.push({
    state: { ...base, path: [...levels, 'row'], steps: idxSteps, rowsChecked: query === 'prefix' ? 3 : 1, found: true, done: true },
    en: `Jump straight to row ${fmt(target + 1)}. ${idxSteps} steps instead of ${fmt(n)} rows.`,
    bn: `সরাসরি row ${fmt(target + 1)}-এ। ${fmt(n)} row-এর বদলে ${idxSteps} ধাপ।`,
    tone: 'ok',
  });
  return steps;
}
