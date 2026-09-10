/** Leitner spaced repetition. Pure functions only — no storage, no React. */

export const LEITNER_DAYS = [0, 1, 3, 7, 21, 60] as const;
export const MAX_BOX = LEITNER_DAYS.length - 1; // 5

export interface CardState {
  box: number; // 0..5
  due: number; // day number (days since epoch) when the card is next due
  seen: number; // times graded
  miss: number; // times marked "Missed"
}

export const DAY_MS = 86_400_000;

export function todayNumber(now: number = Date.now()): number {
  return Math.floor(now / DAY_MS);
}

export function freshCard(): CardState {
  return { box: 0, due: 0, seen: 0, miss: 0 };
}

/** "Got it" moves the card up one box; "Missed" resets it to box 0 and counts the miss. */
export function grade(state: CardState, ok: boolean, today: number): CardState {
  const box = ok ? Math.min(MAX_BOX, state.box + 1) : 0;
  return {
    box,
    due: today + LEITNER_DAYS[box],
    seen: state.seen + 1,
    miss: state.miss + (ok ? 0 : 1),
  };
}

export function isDue(state: CardState | undefined, today: number): boolean {
  return (state?.due ?? 0) <= today;
}

/**
 * Mastery of a module = average box level of its cards / 5, as a percentage.
 * Cards never seen count as box 0. Returns null when the module has no cards.
 */
export function mastery(cardKeys: string[], states: Record<string, CardState | undefined>): number | null {
  if (cardKeys.length === 0) return null;
  const total = cardKeys.reduce((sum, k) => sum + (states[k]?.box ?? 0), 0);
  return Math.round((100 * total) / (cardKeys.length * MAX_BOX));
}

export const PASS_PCT = 60;

/** "Passed" is earned by drilling: mastery of 60% or more. Nothing else gates it. */
export function isPassed(masteryPct: number | null): boolean {
  return (masteryPct ?? 0) >= PASS_PCT;
}

/** Most-missed cards first; cards with zero misses are excluded. */
export function weakSpots<T extends { key: string }>(
  cards: T[],
  states: Record<string, CardState | undefined>,
  limit = 5,
): Array<{ card: T; miss: number }> {
  return cards
    .map((card) => ({ card, miss: states[card.key]?.miss ?? 0 }))
    .filter((x) => x.miss > 0)
    .sort((a, b) => b.miss - a.miss)
    .slice(0, limit);
}

/** Streak: consecutive days with at least one graded card or interview answer. */
export function touchStreak(
  streak: { lastDay: number | null; streak: number },
  today: number,
): { lastDay: number; streak: number } {
  if (streak.lastDay === today) return { lastDay: today, streak: streak.streak };
  const next = streak.lastDay === today - 1 ? streak.streak + 1 : 1;
  return { lastDay: today, streak: next };
}

/** Deterministic shuffle so tests can check it; pass Math.random in the app. */
export function shuffle<T>(list: T[], random: () => number = Math.random): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
