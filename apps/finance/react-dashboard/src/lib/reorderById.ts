/**
 * Reorders `items` to match `orderedIds`.
 *
 * Ids that match nothing are skipped, and any item the caller did not mention
 * keeps its existing relative order at the end. Both matter because the caller
 * is usually a list that was rendered some time ago: if it raced with a delete,
 * an import, or another tab's write, reordering what it recognises is right and
 * dropping what it has not seen is not.
 *
 * Shared by the repository write and the optimistic cache update so the order
 * shown during a drag and the order stored afterwards cannot disagree.
 */
export function reorderById<T extends { id: string }>(items: T[], orderedIds: string[]): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const placed = new Set<string>();
  const ordered: T[] = [];

  for (const id of orderedIds) {
    const item = byId.get(id);
    // A repeated id takes its first position rather than duplicating the item -
    // the output is a permutation of the input, never longer than it.
    if (!item || placed.has(id)) continue;
    placed.add(id);
    ordered.push(item);
  }

  return [...ordered, ...items.filter((item) => !placed.has(item.id))];
}
