/**
 * Counting and locating react-hook-form validation errors.
 *
 * `Object.keys(formState.errors).length` counts TOP-LEVEL keys, so every
 * problem anywhere inside `persons[]` - across two people, six accounts each,
 * and a dozen fields apiece - reported as "1 field needs attention". The count
 * was wrong in the one direction that matters: it under-reported, so a user
 * fixing the one field it named still couldn't save and had nothing to go on.
 */

/** RHF marks a leaf by giving it a `type`; `message` is the copy Zod supplied. */
function isLeafError(node: unknown): boolean {
  if (typeof node !== 'object' || node === null) return false;
  const record = node as Record<string, unknown>;
  return typeof record.type === 'string' || typeof record.message === 'string';
}

/** Every leaf error in the tree, however deeply nested. */
export function countFieldErrors(node: unknown): number {
  if (typeof node !== 'object' || node === null) return 0;
  if (isLeafError(node)) return 1;

  let total = 0;
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    // `ref` points back at the DOM node, and `root` is RHF's own array-level
    // slot - neither is a field the user can go and fix.
    if (key === 'ref') continue;
    total += countFieldErrors(value);
  }
  return total;
}

/**
 * Which person tabs contain an error, by index.
 *
 * Without this the count told you something was wrong but not where, on a form
 * split across tabs where most of it is off screen at any moment. RHF keeps
 * `persons` as a sparse array-like keyed by index, so the keys ARE the tabs.
 */
export function personIndexesWithErrors(errors: unknown): Set<number> {
  const found = new Set<number>();
  if (typeof errors !== 'object' || errors === null) return found;

  const persons = (errors as Record<string, unknown>).persons;
  if (typeof persons !== 'object' || persons === null) return found;

  for (const [key, value] of Object.entries(persons as Record<string, unknown>)) {
    const index = Number(key);
    if (!Number.isInteger(index)) continue;
    if (countFieldErrors(value) > 0) found.add(index);
  }
  return found;
}

/** True when anything outside `persons` is invalid - i.e. the Household tab. */
export function householdHasErrors(errors: unknown): boolean {
  if (typeof errors !== 'object' || errors === null) return false;
  return Object.entries(errors as Record<string, unknown>).some(([key, value]) => key !== 'persons' && countFieldErrors(value) > 0);
}
