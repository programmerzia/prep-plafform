import { useMemo } from 'react';
import { ALL_CARDS, MODULES, UNLOCKED, cardsOf, type CardRef } from '../content/loader';
import type { Module } from '../content/schema';
import { isDue, mastery, todayNumber, weakSpots, type CardState } from '../logic/leitner';
import { useStore } from './Store';

export function moduleMastery(m: Module, cards: Record<string, CardState>): number | null {
  if (m.status !== 'unlocked') return null;
  return mastery(cardsOf(m).map((c) => c.key), cards);
}

export function useMastery() {
  const { cards } = useStore();
  return useMemo(() => {
    const byModule: Record<string, number | null> = {};
    for (const m of MODULES) byModule[m.id] = moduleMastery(m, cards);
    return byModule;
  }, [cards]);
}

export function useDueCards(moduleId?: string): CardRef[] {
  const { cards } = useStore();
  return useMemo(() => {
    const today = todayNumber();
    return ALL_CARDS.filter((c) => (!moduleId || c.moduleId === moduleId) && isDue(cards[c.key], today));
  }, [cards, moduleId]);
}

export function useWeakSpots(limit = 5) {
  const { cards } = useStore();
  return useMemo(() => weakSpots(ALL_CARDS, cards, limit), [cards, limit]);
}

/** Next module on the path = first preview module in path order. Weak = unlocked and under 60%. */
export function usePath() {
  const m = useMastery();
  return useMemo(() => {
    const next = MODULES.find((x) => x.status === 'preview');
    const weak = UNLOCKED.filter((x) => (m[x.id] ?? 0) < 60);
    const passed = UNLOCKED.filter((x) => (m[x.id] ?? 0) >= 60);
    // 60-day window: modules the mentor starred; passed = unlocked and mastery >= 60%
    const starred = MODULES.filter((x) => x.star);
    const starredPassed = starred.filter((x) => x.status === 'unlocked' && (m[x.id] ?? 0) >= 60);
    return { next, weak, passed, starred, starredPassed, unlocked: UNLOCKED.length, total: MODULES.length };
  }, [m]);
}

export function trackMastery(track: string, m: Record<string, number | null>): number | null {
  const mods = UNLOCKED.filter((x) => x.track === track);
  if (!mods.length) return null;
  return Math.round(mods.reduce((s, x) => s + (m[x.id] ?? 0), 0) / mods.length);
}
