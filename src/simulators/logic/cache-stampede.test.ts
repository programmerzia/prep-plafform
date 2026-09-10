import { describe, it, expect } from 'vitest';
import { buildSteps, loadFor, peakLoad } from './cache-stampede';

describe('cache-stampede logic', () => {
  it('no protection: every request hits the DB at expiry, load 100%, overloaded', () => {
    const s = buildSteps('none', 'lock', 1000, 10);
    const hit = s.find((x) => x.state.dbQueries === 1000)!;
    expect(hit.state.dbLoad).toBe(100);
    expect(hit.state.overloaded).toBe(true);
    expect(s[s.length - 1].state.done).toBe(true);
  });
  it('a small crowd does not overload even unprotected', () => {
    expect(peakLoad('none', 'lock', 20, 10)).toBe(loadFor(20));
    expect(loadFor(20)).toBe(40);
  });
  it('lock + single refresh: one query, the rest wait then read cache', () => {
    const s = buildSteps('fix', 'lock', 1000, 10);
    expect(peakLoad('fix', 'lock', 1000, 10)).toBe(2);
    expect(s.some((x) => x.state.served.waiting === 999)).toBe(true);
    expect(s[s.length - 1].state.served.fromCache).toBeGreaterThanOrEqual(999);
  });
  it('stale-while-revalidate serves everyone stale immediately with one background query', () => {
    const s = buildSteps('fix', 'swr', 1000, 10);
    expect(s.some((x) => x.state.served.stale === 1000 && x.state.dbQueries === 1)).toBe(true);
  });
  it('jittered TTL uses five caches expiring at different seconds', () => {
    const s = buildSteps('fix', 'jitter', 1000, 10);
    expect(s[0].state.caches).toHaveLength(5);
    expect(new Set(s[0].state.caches.map((c) => c.expiresAt)).size).toBe(5);
    expect(peakLoad('fix', 'jitter', 1000, 10)).toBe(2);
  });
});
