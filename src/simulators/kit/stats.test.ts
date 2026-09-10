import { describe, it, expect } from 'vitest';
import { hitRate, overallHitRate, playDelay, recordPrediction } from './stats';

describe('simulator prediction stats', () => {
  it('counts asked and hits per simulator', () => {
    let s = recordPrediction({}, 'event-loop', true);
    s = recordPrediction(s, 'event-loop', false);
    s = recordPrediction(s, 'join-fanout', true);
    expect(s['event-loop']).toEqual({ asked: 2, hits: 1 });
    expect(hitRate(s['event-loop'])).toBe(50);
    expect(overallHitRate(s)).toBe(67);
  });
  it('is null before any prediction', () => {
    expect(hitRate(undefined)).toBeNull();
    expect(overallHitRate({})).toBeNull();
  });
  it('auto-play slows down at 0.5x and speeds up at 2x', () => {
    expect(playDelay(1)).toBe(1200);
    expect(playDelay(0.5)).toBe(2400);
    expect(playDelay(2)).toBe(600);
    expect(playDelay(1, true)).toBe(1600);
  });
});
