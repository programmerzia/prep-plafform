import { describe, it, expect } from 'vitest';
import { buildSteps, ticketsSold } from './lock-race';

describe('lock-race logic', () => {
  it('no lock in the overlap window sells two tickets for one seat and seats go negative', () => {
    const s = buildSteps('none', '2x1');
    const last = s[s.length - 1].state;
    expect(last.tickets).toBe(2);
    expect(last.seats).toBe(-1);
  });
  it('no lock but no overlap (delay 4) is accidentally correct', () => {
    expect(ticketsSold('none', '2x1', 'forUpdate', 4)).toBe(1);
  });
  it('FOR UPDATE makes B wait, then read 0 and be refused', () => {
    const s = buildSteps('fix', '2x1', 'forUpdate');
    expect(s.some((x) => x.state.lanes[1].status === 'waiting')).toBe(true);
    const last = s[s.length - 1].state;
    expect(last.tickets).toBe(1);
    expect(last.seats).toBe(0);
    expect(last.lanes[1].status).toBe('refused');
  });
  it('atomic UPDATE WHERE seats > 0 sells exactly one', () => {
    expect(ticketsSold('fix', '2x1', 'atomic')).toBe(1);
  });
  it('optimistic version: B fails the version check, retries, then is refused', () => {
    const s = buildSteps('fix', '2x1', 'optimistic');
    expect(s.some((x) => x.state.lanes[1].status === 'retry')).toBe(true);
    expect(s[s.length - 1].state.tickets).toBe(1);
  });
  it('3 users, 2 seats: no lock oversells, a lock sells exactly two', () => {
    expect(ticketsSold('none', '3x2')).toBe(3);
    expect(ticketsSold('fix', '3x2', 'forUpdate')).toBe(2);
    expect(ticketsSold('fix', '3x2', 'atomic')).toBe(2);
  });
});
