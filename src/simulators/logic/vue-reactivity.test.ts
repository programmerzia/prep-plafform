import { describe, it, expect } from 'vitest';
import { buildSteps, codeFor, finalView } from './vue-reactivity';

describe('vue-reactivity logic', () => {
  it('destructuring a reactive object freezes the view; toRefs fixes it', () => {
    expect(finalView('broken', 'destructure', 'toRefs').view).toBe('0');
    expect(finalView('fixed', 'destructure', 'toRefs').view).toBe('2');
    expect(finalView('fixed', 'destructure', 'storeToRefs').view).toBe('2');
    expect(finalView('fixed', 'destructure', 'computed').view).toBe('2');
  });
  it('copying the value freezes the view; computed or toRef fixes it', () => {
    expect(finalView('broken', 'copy', 'computed').view).toBe('0');
    expect(finalView('fixed', 'copy', 'toRef').view).toBe('2');
  });
  it('replacing a reactive array is invisible; mutating or ref.value works', () => {
    expect(finalView('broken', 'array', 'mutate').view).toBe('Ahmed');
    expect(finalView('fixed', 'array', 'mutate').view).toBe('Rahman, Islam');
    expect(finalView('fixed', 'array', 'ref').view).toBe('Rahman, Islam');
  });
  it('.value in the template renders undefined with a warning; plain {{ count }} works', () => {
    const broken = buildSteps('broken', 'value', 'unwrap');
    expect(broken.at(-1)!.state.view).toBe('undefined');
    expect(broken.some((s) => s.state.warning?.includes('already unwrapped'))).toBe(true);
    expect(finalView('fixed', 'value', 'unwrap').view).toBe('2');
  });
  it('watch(state.count) never fires; a getter source fires on every change', () => {
    expect(finalView('broken', 'watch', 'getter').logs).toBe(0);
    expect(finalView('broken', 'watch', 'getter').view).toBe('2'); // the view itself was fine
    expect(finalView('fixed', 'watch', 'getter').logs).toBe(2);
    expect(finalView('fixed', 'watch', 'toRef').logs).toBe(2);
  });
  it('fixed code marks the changed lines', () => {
    expect(codeFor('broken', 'destructure', 'toRefs').changed).toEqual([]);
    expect(codeFor('fixed', 'destructure', 'toRefs').changed).toEqual([2, 3]);
  });
});
