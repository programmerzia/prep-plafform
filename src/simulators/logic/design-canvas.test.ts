import { describe, it, expect } from 'vitest';
import { commit, makeHistory, redo, snap, templateReference, templateStarter, TEMPLATES, undo, PALETTE } from './design-canvas';
import type { CanvasDoc } from '../../store/types';

const doc = (name: string): CanvasDoc => ({ id: name, name, boxes: [], arrows: [], updated: 0 });

describe('design-canvas helpers', () => {
  it('snaps to a 20px grid only when on', () => {
    expect(snap(37, true)).toBe(40);
    expect(snap(29, true)).toBe(20);
    expect(snap(37, false)).toBe(37);
  });
  it('undo and redo walk the history; a new commit clears redo', () => {
    let h = makeHistory(doc('a'));
    h = commit(h, doc('b'));
    h = commit(h, doc('c'));
    expect(h.present.name).toBe('c');
    h = undo(h);
    expect(h.present.name).toBe('b');
    h = redo(h);
    expect(h.present.name).toBe('c');
    h = undo(undo(h));
    expect(h.present.name).toBe('a');
    expect(undo(h).present.name).toBe('a'); // nothing further back
    h = commit(h, doc('d'));
    expect(h.future).toHaveLength(0);
  });
  it('has the thirteen palette items from the spec', () => {
    expect(PALETTE).toHaveLength(13);
    expect(PALETTE).toContain('Object store');
  });
  it('four templates, each with a starter and a wired reference answer', () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(['shortener', 'ratelimiter', 'notifications', 'saas']);
    for (const t of TEMPLATES) {
      const starter = templateStarter(t, true);
      expect(starter.boxes.length).toBeGreaterThanOrEqual(2);
      expect(starter.boxes.every((b) => b.x % 20 === 0 && b.y % 20 === 0)).toBe(true);
      const ref = templateReference(t);
      const ids = new Set(ref.boxes.map((b) => b.id));
      expect(ref.arrows.every((a) => ids.has(a.from) && ids.has(a.to))).toBe(true);
      expect(ref.arrows.every((a) => a.label)).toBe(true);
      expect(ref.notes?.length).toBeGreaterThan(50);
    }
  });
});
