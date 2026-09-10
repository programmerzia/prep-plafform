import { describe, it, expect } from 'vitest';
import { buildSteps, comparisons, fullScanReason, targetPosition } from './btree-walk';

describe('btree-walk logic', () => {
  it('no index checks every row', () => {
    const s = buildSteps('scan', '4096', 'single', 'eq');
    const last = s[s.length - 1].state;
    expect(last.rowsChecked).toBe(4096);
    expect(last.done).toBe(true);
    expect(last.reason).toBeTruthy();
  });
  it('index walk takes about log2(n) steps: 1,000,000 rows → 20', () => {
    expect(comparisons(1_000_000)).toBe(20);
    const s = buildSteps('index', '1000000', 'single', 'eq');
    const last = s[s.length - 1].state;
    expect(last.steps).toBe(20);
    expect(last.rowsChecked).toBe(1);
    expect(last.path).toEqual(['root', 'branch', 'leaf', 'row']);
  });
  it('prefix LIKE walks a leaf range; suffix LIKE and a cast fall back to a full scan', () => {
    expect(buildSteps('index', '256', 'single', 'prefix').at(-1)!.state.steps).toBe(8 + 3);
    expect(fullScanReason('index', 'single', 'suffix')).toMatch(/START of the name/);
    expect(fullScanReason('index', 'single', 'number')).toMatch(/cast/i);
    expect(buildSteps('index', '256', 'single', 'suffix').at(-1)!.state.rowsChecked).toBe(256);
  });
  it('composite index needs the left-most column', () => {
    expect(fullScanReason('index', 'composite', 'both')).toBeNull();
    expect(fullScanReason('index', 'composite', 'created_only')).toMatch(/customer_id first/);
  });
  it('target position is stable and inside the table', () => {
    expect(targetPosition('Rahman', 16)).toBeLessThan(16);
    expect(targetPosition('Ahmed', 100)).toBe(0);
  });
});
