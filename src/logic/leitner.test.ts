import { describe, it, expect } from 'vitest';
import { LEITNER_DAYS, freshCard, grade, isDue, mastery, isPassed, weakSpots, touchStreak, shuffle, todayNumber, DAY_MS } from './leitner';

describe('leitner intervals', () => {
  it('uses the agreed boxes', () => {
    expect([...LEITNER_DAYS]).toEqual([0, 1, 3, 7, 21, 60]);
  });

  it('"Got it" moves up one box and schedules by the interval of the new box', () => {
    const today = 100;
    let s = freshCard();
    s = grade(s, true, today);
    expect(s.box).toBe(1);
    expect(s.due).toBe(101);
    s = grade(s, true, today);
    expect(s.box).toBe(2);
    expect(s.due).toBe(103);
    s = grade(s, true, today);
    expect(s.due).toBe(107);
    s = grade(s, true, today);
    expect(s.due).toBe(121);
    s = grade(s, true, today);
    expect(s.box).toBe(5);
    expect(s.due).toBe(160);
    expect(s.seen).toBe(5);
    expect(s.miss).toBe(0);
  });

  it('never goes above box 5', () => {
    let s = { box: 5, due: 0, seen: 9, miss: 0 };
    s = grade(s, true, 10);
    expect(s.box).toBe(5);
    expect(s.due).toBe(70);
  });

  it('"Missed" resets to box 0, increments miss, and is due today', () => {
    let s = { box: 4, due: 0, seen: 4, miss: 0 };
    s = grade(s, false, 50);
    expect(s.box).toBe(0);
    expect(s.due).toBe(50);
    expect(s.miss).toBe(1);
    expect(s.seen).toBe(5);
    expect(isDue(s, 50)).toBe(true);
  });

  it('a card is due when its due day has arrived; unseen cards are due', () => {
    expect(isDue(undefined, 5)).toBe(true);
    expect(isDue({ box: 1, due: 6, seen: 1, miss: 0 }, 5)).toBe(false);
    expect(isDue({ box: 1, due: 6, seen: 1, miss: 0 }, 6)).toBe(true);
  });
});

describe('mastery', () => {
  it('is the average box / 5 as a percent, unseen cards count as box 0', () => {
    const keys = ['m:0', 'm:1', 'm:2', 'm:3'];
    const states = {
      'm:0': { box: 5, due: 0, seen: 1, miss: 0 },
      'm:1': { box: 5, due: 0, seen: 1, miss: 0 },
      'm:2': { box: 2, due: 0, seen: 1, miss: 0 },
    };
    // (5+5+2+0) / (4*5) = 12/20 = 60%
    expect(mastery(keys, states)).toBe(60);
  });
  it('is null for modules without cards', () => {
    expect(mastery([], {})).toBeNull();
  });
  it('passes only when unlocked and at least 60%', () => {
    expect(isPassed('unlocked', 60)).toBe(true);
    expect(isPassed('unlocked', 59)).toBe(false);
    expect(isPassed('preview', 100)).toBe(false);
    expect(isPassed('unlocked', null)).toBe(false);
  });
});

describe('weak spots and streak', () => {
  it('sorts most-missed first and drops cards with zero misses', () => {
    const cards = [{ key: 'a' }, { key: 'b' }, { key: 'c' }];
    const states = {
      a: { box: 0, due: 0, seen: 3, miss: 1 },
      b: { box: 0, due: 0, seen: 3, miss: 3 },
      c: { box: 2, due: 0, seen: 2, miss: 0 },
    };
    expect(weakSpots(cards, states).map((w) => w.card.key)).toEqual(['b', 'a']);
  });

  it('streak continues on consecutive days, resets after a gap, and is idempotent per day', () => {
    let s = touchStreak({ lastDay: null, streak: 0 }, 10);
    expect(s).toEqual({ lastDay: 10, streak: 1 });
    s = touchStreak(s, 10);
    expect(s.streak).toBe(1);
    s = touchStreak(s, 11);
    expect(s.streak).toBe(2);
    s = touchStreak(s, 13);
    expect(s.streak).toBe(1);
  });

  it('shuffle keeps all items', () => {
    let n = 0;
    const seq = [0.1, 0.9, 0.5, 0.3];
    const out = shuffle([1, 2, 3, 4, 5], () => seq[n++ % seq.length]);
    expect(out.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('todayNumber counts whole days', () => {
    expect(todayNumber(DAY_MS * 3 + 5)).toBe(3);
  });
});
