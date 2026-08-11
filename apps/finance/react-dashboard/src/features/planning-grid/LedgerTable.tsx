import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@repo/ui/components/table';
import { LedgerColumnGroupHeader } from './LedgerColumnGroupHeader';
import { recallGridScroll, rememberGridScroll } from './gridScrollMemory';
import { buildLedgerColumns, BUCKET_TINTS, type LedgerColumn } from './ledgerColumns';
import { cn } from '../../lib/utils';
import { restoreScrollPosition } from '../../lib/restoreScroll';
import type { MoneyFormatter } from '../../hooks/useDisplayCurrency';
import type { AccountBucket, GridOverride } from '../../engine/schema';
import type { LedgerYearRow } from '../../engine/types';

/** Starting widths for Age / Year / Yrs to-in Ret.; refined to real whole-pixel widths on mount (see useFrozenColumns). */
const FROZEN_COL_WIDTHS = [52, 64, 84] as const;
const FROZEN_COL_CLASS = 'sticky z-[5] bg-surface';
const FROZEN_HEADER_CLASS = 'sticky z-20 bg-surface-raised';

/**
 * Rules drawn as inset shadows rather than borders.
 *
 * The table is `border-collapse: collapse`, where borders belong to the table
 * grid rather than to the cell. A sticky cell therefore keeps its background
 * when you scroll but leaves its border behind with the grid - so the frozen
 * columns lost their right edge when scrolled sideways, and the header's two
 * rules (between its own rows, and between header and body) vanished as soon as
 * you scrolled down. An inset shadow is painted by the cell itself, so it
 * travels with it.
 *
 * ROW_RULE_SHADOW uses --brand-page-fg because that is what the `border-b` it
 * replaces resolved to: Tailwind v4 defaults border-color to currentColor, and
 * these rows inherit the page foreground. Note --foreground is a bare HSL
 * triple, not a color, so it is unusable here - --brand-page-fg is the real hex
 * and matches exactly in both themes.
 */
const FROZEN_EDGE_SHADOW = 'inset -1px 0 0 0 var(--brand-edge)';
const ROW_RULE_SHADOW = 'inset 0 -1px 0 0 var(--brand-page-fg)';

/** Inline rather than a `shadow-[...]` class: Tailwind v4 emits no CSS for arbitrary inset shadows, so those classes silently do nothing. */
const shadows = (...parts: (string | false | null | undefined)[]) => {
  const used = parts.filter(Boolean);
  return used.length > 0 ? used.join(', ') : undefined;
};

/**
 * Pins the frozen columns to whole-pixel widths and derives their sticky `left`
 * offsets from those.
 *
 * A table lays its own columns out - a `width` style is only a hint, and the
 * result is routinely fractional (55.031px, not 52). Two things break on that
 * fraction: the next sticky column starts a sub-pixel away from where the last
 * one ends, and the frozen column's own right edge lands mid-pixel, so that
 * boundary pixel is composited half from the frozen cell and half from the
 * content scrolling underneath it - which is exactly the 1px seam of leaked
 * text. Measuring, rounding UP to whole pixels, and then feeding that back as a
 * hard min/max width makes every edge land on a device pixel with nothing to
 * blend. Ceil is idempotent, so this settles after one pass instead of looping.
 */
function useFrozenColumns(nominalWidths: readonly number[]) {
  const count = nominalWidths.length;
  const cellsRef = useRef<(HTMLTableCellElement | null)[]>([]);
  const [widths, setWidths] = useState<number[]>(() => [...nominalWidths]);

  const measure = useCallback(() => {
    const measured = cellsRef.current.slice(0, count).map((cell) => cell?.getBoundingClientRect().width ?? 0);
    if (measured.some((w) => w === 0)) return;
    const next = measured.map((w) => Math.ceil(w));
    setWidths((prev) => (prev.length === next.length && prev.every((v, i) => v === next[i]) ? prev : next));
  }, [count]);

  useLayoutEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    for (const cell of cellsRef.current.slice(0, count)) if (cell) observer.observe(cell);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure, count]);

  const registerCell = (index: number) => (el: HTMLTableCellElement | null) => {
    cellsRef.current[index] = el;
  };

  /** Locks the column to a whole-pixel width and parks it at the exact sum of the ones before it. */
  const frozenStyle = (index: number) => {
    const width = widths[index];
    const left = widths.slice(0, index).reduce((sum, w) => sum + w, 0);
    return { left, width, minWidth: width, maxWidth: width };
  };

  return { frozenStyle, registerCell };
}

interface LedgerTableProps {
  money: MoneyFormatter;
  buckets: AccountBucket[];
  /** Set only in the combined view, where two people can own identically-named accounts. */
  bucketOwnerLabels?: Record<string, string>;
  /** Jointly-held buckets, grouped separately since nobody's Total Net Worth claims them. */
  sharedBucketIds?: Set<string>;
  rows: LedgerYearRow[];
  overrides: GridOverride[];
  personId: string | null;
  allowOverrides: boolean;
  /** The row whose breakdown the side panel is showing, so it can be marked here. */
  selectedYear: number | null;
  /**
   * Identity of the numbers currently on screen. The grid's scroll offset is
   * remembered across the tab switches that unmount it, and dropped whenever
   * this changes - see gridScrollMemory.
   */
  scrollMemoryKey: string;
  onOpenAudit: (row: LedgerYearRow) => void;
  onEditOverride: (row: LedgerYearRow) => void;
}

export function LedgerTable({
  money,
  buckets: allBuckets,
  bucketOwnerLabels,
  sharedBucketIds,
  rows,
  overrides,
  personId,
  allowOverrides,
  selectedYear,
  scrollMemoryKey,
  onOpenAudit,
  onEditOverride,
}: LedgerTableProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const { frozenStyle, registerCell } = useFrozenColumns(FROZEN_COL_WIDTHS);
  const tableRef = useRef<HTMLTableElement>(null);

  // Table renders its own `overflow-auto` wrapper around the <table>, so that
  // wrapper - the element whose scroll we drive below - is the table's parent.
  const scroller = () => tableRef.current?.parentElement ?? null;

  /**
   * Keeps your place in the grid across tab switches.
   *
   * Leaving the Planning Grid unmounts it, which destroys this scroll
   * container outright - so the offset is parked outside React on every scroll
   * and put back on the way in. Both axes: the grid is far wider than it is
   * tall, so which columns you had scrolled to matters at least as much as
   * which rows.
   *
   * Re-running on scrollMemoryKey is what handles a save: the new key has no
   * offset stored against it, so the grid opens at the top rather than at a
   * position that pointed into numbers which have since been recomputed.
   */
  useLayoutEffect(() => {
    const el = tableRef.current?.parentElement;
    if (!el) return;

    const remembered = recallGridScroll(scrollMemoryKey);
    const cancelRestore = remembered ? restoreScrollPosition(el, remembered) : null;

    const onScroll = () => rememberGridScroll(scrollMemoryKey, { top: el.scrollTop, left: el.scrollLeft });
    el.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      cancelRestore?.();
      el.removeEventListener('scroll', onScroll);
    };
  }, [scrollMemoryKey]);

  function toggle(key: string) {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  /**
   * Click-drag to pan the grid. Only runs on the scrollable body area - the
   * frozen columns keep their click-to-open-breakdown behavior, so the two
   * gestures never have to be told apart on the same pixels.
   *
   * Deliberately does no React state work: the drag cursor and selection lock
   * are toggled straight on the DOM node. Re-rendering a table this wide on the
   * first move of every drag is what made the gesture start with a visible hitch.
   */
  function startDragScroll(e: React.MouseEvent) {
    // Left button only, and never from a control that has its own click.
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, a, input, select, [role="button"]')) return;
    const el = scroller();
    if (!el) return;

    const pressX = e.clientX;
    const pressY = e.clientY;
    // Set once the gesture is confirmed a drag. Re-anchored to that moment
    // rather than to the press, so crossing the slop threshold doesn't snap the
    // grid sideways by the threshold distance in a single frame.
    let origin: { x: number; y: number; left: number; top: number } | null = null;
    let latest: { x: number; y: number } | null = null;
    let frame = 0;

    // Writing scrollLeft/scrollTop synchronously per mousemove is what made a
    // fast drag stutter: each write forces the main thread to re-run sticky
    // positioning and repaint the whole grid, and the browser can deliver
    // several mousemoves per frame. Wheel scrolling never stutters because it
    // runs on the compositor. Coalescing to one write per animation frame gives
    // the drag the same one-update-per-frame budget.
    function apply() {
      frame = 0;
      if (!origin || !latest) return;
      el!.scrollLeft = origin.left - (latest.x - origin.x);
      el!.scrollTop = origin.top - (latest.y - origin.y);
    }

    function onMove(move: MouseEvent) {
      if (!origin) {
        // A few pixels of slop so a slightly-shaky plain click isn't read as a drag.
        if (Math.abs(move.clientX - pressX) < 4 && Math.abs(move.clientY - pressY) < 4) return;
        origin = { x: move.clientX, y: move.clientY, left: el!.scrollLeft, top: el!.scrollTop };
        el!.classList.add('cursor-grabbing', 'select-none');
        el!.classList.remove('cursor-grab');
      }
      move.preventDefault();
      latest = { x: move.clientX, y: move.clientY };
      if (!frame) frame = requestAnimationFrame(apply);
    }

    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (frame) cancelAnimationFrame(frame);
      // One last write, so the grid lands exactly where the pointer left it
      // rather than a frame behind.
      frame = 0;
      apply();
      el!.classList.remove('cursor-grabbing', 'select-none');
      el!.classList.add('cursor-grab');
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  const groups = buildLedgerColumns({
    money,
    buckets: allBuckets,
    bucketOwnerLabels,
    sharedBucketIds,
    overrides,
    personId,
    allowOverrides,
    onEditOverride,
  });

  const visibleColumnsByGroup = groups.map((group) => (collapsed[group.key] ? [] : group.columns));
  const tintClass = (col: LedgerColumn) => (col.tintIndex === undefined ? undefined : BUCKET_TINTS[col.tintIndex]);

  return (
    <div className="border border-edge rounded-[14px] overflow-hidden bg-surface flex-1 min-h-0 flex flex-col">
      <Table
        ref={tableRef}
        className="text-[12.5px]"
        // Grab cursor for the pannable area; the frozen cells set their own
        // pointer cursor, and the cell under the mouse wins over the container.
        // startDragScroll swaps this to cursor-grabbing directly on the node.
        containerClassName="flex-1 min-h-0 cursor-grab"
        onMouseDown={startDragScroll}
      >
        <TableHeader className="bg-surface-raised sticky top-0 z-10 [&_tr]:border-b-0">
          <TableRow className="hover:bg-transparent">
            <TableHead ref={registerCell(0)} rowSpan={2} className={cn('whitespace-nowrap', FROZEN_HEADER_CLASS)} style={{ ...frozenStyle(0), boxShadow: ROW_RULE_SHADOW }}>
              Age
            </TableHead>
            <TableHead ref={registerCell(1)} rowSpan={2} className={cn('whitespace-nowrap', FROZEN_HEADER_CLASS)} style={{ ...frozenStyle(1), boxShadow: ROW_RULE_SHADOW }}>
              Year
            </TableHead>
            <TableHead
              ref={registerCell(2)}
              rowSpan={2}
              className={cn('whitespace-normal leading-tight', FROZEN_HEADER_CLASS)}
              style={{ ...frozenStyle(2), boxShadow: shadows(FROZEN_EDGE_SHADOW, ROW_RULE_SHADOW) }}
            >
              Yrs to/in Ret.
            </TableHead>
            {groups.map((group, i) => (
              <LedgerColumnGroupHeader
                key={group.key}
                label={group.label}
                colSpan={Math.max(1, visibleColumnsByGroup[i].length)}
                collapsed={!!collapsed[group.key]}
                onToggle={() => toggle(group.key)}
              />
            ))}
            <TableHead rowSpan={2} className="whitespace-nowrap text-right" style={{ boxShadow: ROW_RULE_SHADOW }}>
              Total Net Worth
            </TableHead>
          </TableRow>
          <TableRow className="hover:bg-transparent">
            {groups.flatMap((group, i) =>
              collapsed[group.key]
                ? [
                    <TableHead key={`${group.key}-collapsed`} className="whitespace-nowrap border-l border-edge text-dim" style={{ boxShadow: ROW_RULE_SHADOW }}>
                      …
                    </TableHead>,
                  ]
                : visibleColumnsByGroup[i].map((col) => (
                    <TableHead key={col.id} className={cn('whitespace-nowrap border-l border-edge first:border-l-0', tintClass(col))} style={{ boxShadow: ROW_RULE_SHADOW }}>
                      {col.header}
                    </TableHead>
                  )),
            )}
          </TableRow>
        </TableHeader>
        <TableBody className="[&_tr]:border-b-0">
          {rows.map((row, rowIndex) => {
            const selected = selectedYear === row.year;
            // Every cell paints the row separator itself. The collapsed border it
            // replaces did not travel sideways with the sticky frozen cells, and
            // because row heights are fractional it also landed a pixel below a
            // cell-painted shadow - so mixing the two doubled the line. Last row
            // gets none, matching the borderless last row this replaces.
            const rowRule = rowIndex === rows.length - 1 ? null : ROW_RULE_SHADOW;
            return (
              <TableRow key={row.year} className={cn(selected && 'bg-indigo-bg hover:bg-indigo-bg')} data-selected={selected || undefined}>
                {/*
                  Only the frozen columns open the breakdown. The scrollable
                  area to their right is a drag surface instead, so panning the
                  grid never lands on a row and swaps the panel out from under you.
                */}
                <TableCell
                  className={cn(FROZEN_COL_CLASS, 'cursor-pointer', selected && 'bg-indigo-bg')}
                  style={{ ...frozenStyle(0), boxShadow: shadows(rowRule) }}
                  onClick={() => onOpenAudit(row)}
                >
                  {row.age}
                </TableCell>
                <TableCell
                  className={cn('font-mono', FROZEN_COL_CLASS, 'cursor-pointer', selected && 'bg-indigo-bg')}
                  style={{ ...frozenStyle(1), boxShadow: shadows(rowRule) }}
                  onClick={() => onOpenAudit(row)}
                >
                  {row.year}
                </TableCell>
                <TableCell
                  className={cn('font-mono text-dim', FROZEN_COL_CLASS, 'cursor-pointer', selected && 'bg-indigo-bg')}
                  style={{ ...frozenStyle(2), boxShadow: shadows(FROZEN_EDGE_SHADOW, rowRule) }}
                  onClick={() => onOpenAudit(row)}
                >
                  {Number.isNaN(row.yearsToOrInRetirement) ? '—' : row.yearsToOrInRetirement}
                </TableCell>
                {groups.flatMap((group, i) =>
                  collapsed[group.key]
                    ? [
                        <TableCell key={`${group.key}-collapsed`} className="border-l border-edge text-dim" style={{ boxShadow: shadows(rowRule) }}>
                          …
                        </TableCell>,
                      ]
                    : visibleColumnsByGroup[i].map((col) => (
                        <TableCell key={col.id} className={cn('whitespace-nowrap border-l border-edge first:border-l-0 font-mono', tintClass(col))} style={{ boxShadow: shadows(rowRule) }}>
                          {col.render(row)}
                        </TableCell>
                      )),
                )}
                <TableCell className="text-right font-mono font-semibold" style={{ boxShadow: shadows(rowRule) }}>
                  {money.format(row.totalNetWorth)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
