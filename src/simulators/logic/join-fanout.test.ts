import { describe, it, expect } from 'vitest';
import { buildSteps, realRevenue, sumOf } from './join-fanout';

describe('join fan-out simulator logic', () => {
  it('JOIN multiplies the order row per matching item', () => {
    expect(sumOf('join', '42')).toBe(1000);
    expect(sumOf('join', 'all')).toBe(1700);
    expect(sumOf('join', '7')).toBe(700);
  });
  it('EXISTS keeps one row per order and matches real revenue', () => {
    expect(sumOf('exists', '42')).toBe(500);
    expect(sumOf('exists', 'all')).toBe(700);
    expect(realRevenue('42')).toBe(500);
    expect(realRevenue('all')).toBe(700);
  });
  it('the last step is done and every step narrates', () => {
    const s = buildSteps('join', '42');
    expect(s[s.length - 1].state.done).toBe(true);
    expect(s.every((x) => x.en)).toBe(true);
  });
});
