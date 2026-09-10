import { describe, it, expect } from 'vitest';
import { buildSteps, chargesFor } from './idempotent-retry';

describe('idempotent-retry logic', () => {
  it('no key + lost response charges twice', () => {
    expect(chargesFor('none', 'lost')).toBe(2);
  });
  it('same key replays the stored result: one charge', () => {
    const s = buildSteps('key', 'lost');
    const last = s[s.length - 1].state;
    expect(last.ledger).toHaveLength(1);
    expect(last.requests[1].status).toBe('replayed');
    expect(last.clientSees).toContain('#1001');
  });
  it('crash before storing the key double-charges unless key and charge share a transaction', () => {
    expect(chargesFor('key', 'crash', false)).toBe(2);
    expect(chargesFor('key', 'crash', true)).toBe(1);
  });
  it('a new key per attempt is a different payment to the server: two charges', () => {
    expect(chargesFor('key', 'newkey')).toBe(2);
  });
  it('every step narrates and the run ends done', () => {
    const s = buildSteps('key', 'lost');
    expect(s.every((x) => x.en && x.bn)).toBe(true);
    expect(s[s.length - 1].state.done).toBe(true);
  });
});
