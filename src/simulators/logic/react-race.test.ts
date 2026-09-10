import { describe, it, expect } from 'vitest';
import { buildSteps, finalShows, type Options } from './react-race';

const base: Options = { fix: 'flag', latencyJa: 3, latencyJav: 1, strictMode: false, missingDep: false };

describe('react-race logic', () => {
  it('without cleanup the slow "ja" response overwrites the "jav" results', () => {
    expect(finalShows('none', base)).toBe('results for "ja"');
    expect(buildSteps('none', base).at(-1)!.state.wrong).toBe(true);
  });
  it('ignore flag: the late response is ignored', () => {
    const s = buildSteps('fix', { ...base, fix: 'flag' });
    expect(finalShows('fix', { ...base, fix: 'flag' })).toBe('results for "jav"');
    expect(s.some((x) => x.state.requests.some((r) => r.q === 'ja' && r.status === 'ignored'))).toBe(true);
  });
  it('AbortController: the "ja" request is aborted at cleanup', () => {
    const s = buildSteps('fix', { ...base, fix: 'abort' });
    expect(s.some((x) => x.state.requests.some((r) => r.q === 'ja' && r.status === 'aborted'))).toBe(true);
    expect(finalShows('fix', { ...base, fix: 'abort' })).toBe('results for "jav"');
  });
  it('key-based cache shows the entry for the current key', () => {
    expect(finalShows('fix', { ...base, fix: 'rq' })).toBe('results for "jav"');
  });
  it('no race when the first request is faster, even without cleanup', () => {
    expect(finalShows('none', { ...base, latencyJa: 1, latencyJav: 2 })).toBe('results for "jav"');
  });
  it('Strict Mode without cleanup sends two live requests; with cleanup the first is cancelled', () => {
    const none = buildSteps('none', { ...base, strictMode: true });
    expect(none.some((x) => x.state.requests.filter((r) => r.q === 'ja' && r.status === 'flying').length === 2)).toBe(true);
    const fixed = buildSteps('fix', { ...base, strictMode: true, fix: 'abort' });
    expect(fixed.some((x) => x.state.requests.some((r) => r.run === 1 && r.status === 'aborted'))).toBe(true);
  });
  it('missing dependency: no request for "jav" is ever sent', () => {
    const s = buildSteps('none', { ...base, missingDep: true });
    expect(s.at(-1)!.state.requests.some((r) => r.q === 'jav')).toBe(false);
    expect(s.at(-1)!.state.wrong).toBe(true);
  });
});
