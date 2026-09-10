import { describe, it, expect } from 'vitest';
import { backoffSeconds, buildSteps, MAX_ATTEMPTS, summary, type Options } from './queue-backoff';

const base: Options = { workers: 1, failureRate: 30, idempotent: true, onError: 'release' };

describe('queue-backoff logic', () => {
  it('a poison job with immediate retries hammers forever and starves the others (1 worker)', () => {
    const s = buildSteps('none', 'poison', base);
    const last = s[s.length - 1].state;
    expect(last.done).toBe(0);
    expect(last.starved).toBe(true);
    expect(last.jobs[0].attempts).toBeGreaterThan(10);
  });
  it('backoff + dead-letter: the poison job dies after 3 attempts and the rest finish', () => {
    const r = summary('fix', 'poison', base);
    expect(r.dead).toBe(1);
    expect(r.done).toBe(5);
    const s = buildSteps('fix', 'poison', base);
    expect(s[s.length - 1].state.jobs[0].attempts).toBe(MAX_ATTEMPTS);
  });
  it('backoff grows 1, 2, 4… seconds with a little jitter', () => {
    expect(backoffSeconds(1, 1)).toBeGreaterThanOrEqual(1);
    expect(backoffSeconds(3, 1)).toBeGreaterThanOrEqual(4);
    expect(backoffSeconds(3, 1)).toBeLessThanOrEqual(5);
    expect(backoffSeconds(10, 1)).toBeLessThanOrEqual(31);
  });
  it('fail() on first error sends a failing job straight to the tray', () => {
    const s = buildSteps('fix', 'poison', { ...base, onError: 'fail' });
    expect(s[s.length - 1].state.jobs[0].attempts).toBe(1);
    expect(s[s.length - 1].state.dead).toBe(1);
  });
  it('more workers raise throughput', () => {
    const one = buildSteps('fix', 'normal', { ...base, workers: 1 });
    const four = buildSteps('fix', 'normal', { ...base, workers: 4 });
    expect(four[four.length - 1].state.t).toBeLessThan(one[one.length - 1].state.t);
  });
  it('a retried job runs its side effect once per attempt', () => {
    const s = buildSteps('fix', 'normal', { ...base, failureRate: 60, idempotent: false });
    const retried = s[s.length - 1].state.jobs.find((j) => j.attempts > 1);
    expect(retried).toBeTruthy();
    expect(retried!.sideEffects).toBe(retried!.attempts);
  });
});
