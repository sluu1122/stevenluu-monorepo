/**
 * Where the Planning Grid's scroll container was left, remembered across the
 * tab switches that unmount it.
 *
 * This has to live outside React. Leaving the Planning Grid unmounts the whole
 * tab (App.tsx force-mounts only Scenario Setup), so the scroll container is
 * destroyed along with any component state or ref that might have held its
 * offset. It's the same trick App.tsx uses to remember each tab's outer scroll
 * offset, applied one level further in - to the grid's own scroller, which the
 * outer one knows nothing about.
 *
 * The offset is stamped with the scenario revision it was taken at and only
 * handed back while that still matches. A save recomputes every number in the
 * grid, so the row a remembered offset pointed at has moved; opening at the
 * top beats restoring to somewhere arbitrary. Same rule App.tsx applies when
 * it drops its own offsets on a save.
 */
export interface GridScrollOffset {
  top: number;
  left: number;
}

let remembered: (GridScrollOffset & { revision: string }) | null = null;

export function rememberGridScroll(revision: string, offset: GridScrollOffset): void {
  remembered = { revision, ...offset };
}

/** The offset saved for this exact revision, or null when there is none or a save has invalidated it. */
export function recallGridScroll(revision: string): GridScrollOffset | null {
  if (!remembered || remembered.revision !== revision) return null;
  return { top: remembered.top, left: remembered.left };
}

/** Test seam - module-level state would otherwise leak between cases. */
export function clearGridScrollMemory(): void {
  remembered = null;
}
