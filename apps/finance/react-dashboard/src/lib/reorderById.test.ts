import { describe, expect, it } from 'vitest';
import { reorderById } from './reorderById';

const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

describe('reorderById', () => {
  it('puts the items into the order given', () => {
    expect(reorderById(items, ['c', 'a', 'b'])).toEqual([{ id: 'c' }, { id: 'a' }, { id: 'b' }]);
  });

  it('leaves the list alone when the order already matches', () => {
    expect(reorderById(items, ['a', 'b', 'c'])).toEqual(items);
  });

  // The three below are all the same scenario: the caller is a list that was
  // rendered earlier and may no longer agree with the store, because a delete,
  // an import, or another tab wrote in between.
  it('skips ids that no longer exist', () => {
    expect(reorderById(items, ['c', 'gone', 'a', 'b'])).toEqual([{ id: 'c' }, { id: 'a' }, { id: 'b' }]);
  });

  it('keeps items the caller never mentioned, in their existing relative order', () => {
    expect(reorderById(items, ['c'])).toEqual([{ id: 'c' }, { id: 'a' }, { id: 'b' }]);
  });

  it('returns the list unchanged when told nothing', () => {
    expect(reorderById(items, [])).toEqual(items);
  });

  it('never duplicates an item, however often its id is repeated', () => {
    expect(reorderById(items, ['b', 'b', 'a'])).toEqual([{ id: 'b' }, { id: 'a' }, { id: 'c' }]);
  });

  it('does not mutate the input', () => {
    const original = [...items];
    reorderById(items, ['c', 'b', 'a']);
    expect(items).toEqual(original);
  });
});
