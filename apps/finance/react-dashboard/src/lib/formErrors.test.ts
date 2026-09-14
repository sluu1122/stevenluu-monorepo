import { describe, expect, it } from 'vitest';
import { countFieldErrors, householdHasErrors, personIndexesWithErrors } from './formErrors';

/** Shaped the way react-hook-form actually nests them. */
const errors = {
  name: { type: 'too_small', message: 'Required', ref: {} },
  persons: {
    0: {
      label: { type: 'too_small', message: 'Required', ref: {} },
      accountBuckets: {
        2: { startingBalance: { type: 'invalid_type', message: 'Expected number', ref: {} } },
      },
    },
    2: {
      birthYear: { type: 'invalid_type', message: 'Expected number', ref: {} },
    },
  },
};

describe('countFieldErrors', () => {
  it('counts every leaf, not just the top-level keys', () => {
    // The old count was Object.keys(errors).length === 2.
    expect(countFieldErrors(errors)).toBe(4);
  });

  it('is zero for a clean form', () => {
    expect(countFieldErrors({})).toBe(0);
  });

  it('does not walk into the DOM ref, which is not a field', () => {
    expect(countFieldErrors({ a: { type: 't', message: 'm', ref: { type: 'x', message: 'y' } } })).toBe(1);
  });

  it('counts a leaf carrying only a message', () => {
    expect(countFieldErrors({ a: { message: 'bad' } })).toBe(1);
  });
});

describe('personIndexesWithErrors', () => {
  it('names the tabs that actually contain a problem', () => {
    expect([...personIndexesWithErrors(errors)].sort()).toEqual([0, 2]);
  });

  it('is empty when only household-level fields are invalid', () => {
    expect(personIndexesWithErrors({ name: { type: 't', message: 'm' } }).size).toBe(0);
  });
});

describe('householdHasErrors', () => {
  it('is true for a field outside persons', () => {
    expect(householdHasErrors(errors)).toBe(true);
  });

  it('is false when every problem is inside a person', () => {
    expect(householdHasErrors({ persons: { 0: { label: { type: 't', message: 'm' } } } })).toBe(false);
  });
});
