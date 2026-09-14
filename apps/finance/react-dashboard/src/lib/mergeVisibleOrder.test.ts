import { describe, expect, it } from 'vitest';
import { mergeVisibleOrder } from './mergeVisibleOrder';

/** Stands in for "the household holds an account of this kind". */
const held = (kind: string) => kind.startsWith('CA_');

describe('mergeVisibleOrder', () => {
  it('reorders the visible items without moving the hidden ones', () => {
    const full = ['CA_CASH', 'US_CASH', 'CA_RRSP', 'US_401K', 'CA_TFSA'];
    // The user dragged CA_TFSA to the front of the three rows they can see.
    const merged = mergeVisibleOrder(full, ['CA_TFSA', 'CA_CASH', 'CA_RRSP'], held);

    // US_CASH and US_401K are untouched, still at index 1 and 3.
    expect(merged).toEqual(['CA_TFSA', 'US_CASH', 'CA_CASH', 'US_401K', 'CA_RRSP']);
  });

  it('never drops a hidden item, which is the whole point', () => {
    const full = ['US_CASH', 'CA_CASH', 'US_401K', 'CA_TFSA', 'US_ROTH'];
    const merged = mergeVisibleOrder(full, ['CA_TFSA', 'CA_CASH'], held);

    expect(merged).toHaveLength(full.length);
    for (const hidden of full.filter((k) => !held(k))) {
      expect(merged).toContain(hidden);
    }
  });

  it('leaves the list alone when the visible order is unchanged', () => {
    const full = ['CA_CASH', 'US_CASH', 'CA_TFSA'];
    expect(mergeVisibleOrder(full, ['CA_CASH', 'CA_TFSA'], held)).toEqual(full);
  });

  it('handles every item being visible', () => {
    const full = ['CA_CASH', 'CA_RRSP', 'CA_TFSA'];
    expect(mergeVisibleOrder(full, ['CA_TFSA', 'CA_RRSP', 'CA_CASH'], held)).toEqual(['CA_TFSA', 'CA_RRSP', 'CA_CASH']);
  });

  it('handles nothing being visible', () => {
    const full = ['US_CASH', 'US_401K'];
    expect(mergeVisibleOrder(full, [], held)).toEqual(full);
  });

  it('keeps a hidden item that sits at the very end', () => {
    const full = ['CA_CASH', 'CA_TFSA', 'US_ROTH'];
    expect(mergeVisibleOrder(full, ['CA_TFSA', 'CA_CASH'], held)).toEqual(['CA_TFSA', 'CA_CASH', 'US_ROTH']);
  });
});
