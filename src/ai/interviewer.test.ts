import { describe, it, expect } from 'vitest';
import { offlineQuestion, parseScore, structureHits } from './interviewer';
import type { Module } from '../content/schema';

const base: Module = {
  id: 'x', track: 'sql', phase: 1, order: 1, title: 'X', status: 'unlocked', star: false,
  lesson: { problem: '', picture: '', hook: '', concept: 'c', simple: '', bn: 'b', crossStack: [], docs: [], versions: [] },
  practice: [], interview: [], cards: [{ q: 'cq', a: 'ca' }], glossary: [],
};

describe('offline interviewer', () => {
  it('prefers the interview list', () => {
    const m = { ...base, interview: [{ q: 'iq', model: 'im', missing: 'mm', followUp: 'f', bn: 'b' }] };
    expect(offlineQuestion(m, () => 0)).toMatchObject({ q: 'iq', model: 'im', missing: 'mm', fromCards: false });
  });
  it('falls back to cards when no interview questions exist', () => {
    expect(offlineQuestion(base, () => 0)).toMatchObject({ q: 'cq', model: 'ca', fromCards: true });
  });
  it('returns null with nothing to ask', () => {
    expect(offlineQuestion({ ...base, cards: [] })).toBeNull();
  });
  it('parses the score line and clamps', () => {
    expect(parseScore('SCORE: 7\nVERDICT: ok')).toBe(7);
    expect(parseScore('SCORE: 14')).toBe(10);
    expect(parseScore('nothing')).toBeNull();
  });
  it('detects the four structure parts', () => {
    const h = structureHits('The context was a slow endpoint. We decided to add an index. The trade-off is slower writes. As a result p95 dropped.');
    expect(Object.values(h).every(Boolean)).toBe(true);
  });
});
