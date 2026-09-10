import { describe, it, expect } from 'vitest';
import { buildSteps, DEFAULT_OPS, hitsOf, type Op } from './lru-cache';

describe('lru-cache logic', () => {
  it('LRU keeps the recently read key and evicts the least recently used', () => {
    const ops: Op[] = [
      { kind: 'set', key: 'a', value: '1' }, { kind: 'set', key: 'b', value: '2' }, { kind: 'get', key: 'a' },
      { kind: 'set', key: 'c', value: '3' }, // capacity 2 → evict b (a was just read)
      { kind: 'get', key: 'a' }, { kind: 'get', key: 'b' },
    ];
    const s = buildSteps('lru', 2, ops);
    expect(s[4].state.evicted).toBe('b');
    expect(hitsOf('lru', 2, ops)).toEqual({ hits: 2, gets: 3 });
  });
  it('FIFO ignores reads and evicts the oldest inserted', () => {
    const ops: Op[] = [
      { kind: 'set', key: 'a', value: '1' }, { kind: 'set', key: 'b', value: '2' }, { kind: 'get', key: 'a' },
      { kind: 'set', key: 'c', value: '3' }, // FIFO → evict a although it was just read
      { kind: 'get', key: 'a' },
    ];
    const s = buildSteps('fifo', 2, ops);
    expect(s[4].state.evicted).toBe('a');
    expect(hitsOf('fifo', 2, ops).hits).toBe(1);
  });
  it('default script at capacity 2: LRU 3 of 4 hits, FIFO 2 of 4', () => {
    expect(hitsOf('lru', 2, DEFAULT_OPS)).toEqual({ hits: 3, gets: 4 });
    expect(hitsOf('fifo', 2, DEFAULT_OPS)).toEqual({ hits: 2, gets: 4 });
  });
  it('set on an existing key updates in place and never evicts', () => {
    const s = buildSteps('lru', 2, [{ kind: 'set', key: 'a', value: '1' }, { kind: 'set', key: 'b', value: '2' }, { kind: 'set', key: 'a', value: '9' }]);
    const last = s[s.length - 1].state;
    expect(last.list.map((n) => `${n.key}=${n.value}`)).toEqual(['a=9', 'b=2']);
    expect(s.some((x) => x.state.evicted)).toBe(false);
  });
});
