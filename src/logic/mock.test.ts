import { describe, it, expect } from 'vitest';
import { buildMock, mockReport } from './mock';
import type { Module } from '../content/schema';

function mod(id: string, cards: number, interview = 0): Module {
  return {
    id, track: 'sql', phase: 1, order: 1, title: id.toUpperCase(), status: 'unlocked', star: false,
    lesson: { problem: '', picture: '', hook: '', concept: 'c', simple: '', bn: 'b', crossStack: [], docs: [] },
    practice: [],
    interview: Array.from({ length: interview }, (_, i) => ({ q: `${id}-iq${i}`, model: 'm', missing: `${id}-miss`, followUp: '', bn: '' })),
    cards: Array.from({ length: cards }, (_, i) => ({ q: `${id}-c${i}`, a: 'a' })),
    glossary: [],
  };
}

const fixed = () => 0.42;

describe('buildMock', () => {
  it('returns six questions spread across modules', () => {
    const qs = buildMock([mod('a', 5), mod('b', 5), mod('c', 5)], fixed);
    expect(qs).toHaveLength(6);
    const counts = qs.reduce<Record<string, number>>((acc, q) => ({ ...acc, [q.moduleId]: (acc[q.moduleId] ?? 0) + 1 }), {});
    expect(Object.values(counts)).toEqual([2, 2, 2]);
  });
  it('prefers interview questions over cards', () => {
    const qs = buildMock([mod('a', 3, 2)], fixed, 2);
    expect(qs.every((q) => q.q.includes('iq'))).toBe(true);
  });
  it('skips modules with nothing to ask and never repeats a question', () => {
    const empty = mod('p', 0);
    const qs = buildMock([empty, mod('a', 4)], fixed);
    expect(qs).toHaveLength(4);
    expect(new Set(qs.map((q) => q.q)).size).toBe(4);
  });
});

describe('mockReport', () => {
  it('lists modules under 7 with the missing sentence', () => {
    const r = mockReport([
      { moduleId: 'a', moduleTitle: 'A', q: 'q1', score: 4, missing: 'say this' },
      { moduleId: 'b', moduleTitle: 'B', q: 'q2', score: 9, missing: '' },
    ]);
    expect(r.avg).toBe(6.5);
    expect(r.text).toContain('A — 4/10');
    expect(r.text).toContain('say this');
    expect(r.text).toContain('Solid: B');
  });
});
