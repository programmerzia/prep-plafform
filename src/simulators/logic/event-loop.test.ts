import { describe, it, expect } from 'vitest';
import { buildSteps, outputOf } from './event-loop';

describe('event loop simulator logic', () => {
  it('real engine: sync first, then all microtasks, then one macrotask', () => {
    expect(outputOf('real', 'a')).toBe('1 4 3 2');
    expect(outputOf('real', 'b')).toBe("'a' 'c' 'b'");
    expect(outputOf('real', 'c')).toBe("'S' 'M1' 'T1' 'M-in-T1' 'T-in-M1'");
  });
  it('naive single queue gives the wrong order people expect', () => {
    expect(outputOf('naive', 'a')).toBe('1 4 2 3');
  });
  it('every step has narration and the run ends in done', () => {
    const steps = buildSteps('real', 'c');
    expect(steps.every((s) => s.en.length > 0)).toBe(true);
    expect(steps[steps.length - 1].state.done).toBe(true);
    expect(steps[0].state.out).toEqual([]);
  });
});
