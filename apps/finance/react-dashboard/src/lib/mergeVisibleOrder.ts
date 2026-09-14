/**
 * Writes a reordering of a VISIBLE subset back into the full list, leaving
 * every hidden item pinned at the absolute position it already held.
 *
 * The Withdrawal Order list only renders account kinds the household actually
 * holds, but the stored order covers all of them - a kind nobody owns still
 * owns a position, and has to keep it for when an account of that kind is
 * added back. Reordering the visible rows must therefore not disturb, drop, or
 * re-sort the hidden ones.
 *
 * Walking the full list and refilling only its visible slots does that in one
 * pass. `visible` is expected to be a permutation of the visible members of
 * `full`, which is what a drag-and-drop reorder always produces; anything
 * shorter leaves the trailing visible slots undefined, so callers that can
 * add or remove members should write the full list directly instead.
 */
export function mergeVisibleOrder<T>(full: T[], visible: T[], isVisible: (item: T) => boolean): T[] {
  let next = 0;
  return full.map((item) => (isVisible(item) ? visible[next++] : item));
}
