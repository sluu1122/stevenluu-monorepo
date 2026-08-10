import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@repo/ui/components/table';
import { Pencil } from 'lucide-react';
import { LedgerColumnGroupHeader } from './LedgerColumnGroupHeader';
import { CellOverrideBadge } from './CellOverrideBadge';
import { recallGridScroll, rememberGridScroll } from './gridScrollMemory';
import { cn } from '../../lib/utils';
import { restoreScrollPosition } from '../../lib/restoreScroll';
import { bucketHeading, categorizeBuckets, sumAccountEnd } from '../../lib/investmentCategories';
import type { MoneyFormatter } from '../../hooks/useDisplayCurrency';
import type { AccountBucket, GridOverride } from '../../engine/schema';
import type { LedgerYearRow } from '../../engine/types';

interface LedgerColumn {
  id: string;
  header: ReactNode;
  render: (row: LedgerYearRow) => ReactNode;
  /** Tints a whole account's column run so its Start/Net/End read as one unit. */
  tintIndex?: number;
}

interface LedgerColumnGroup {
  key: string;
  label: string;
  columns: LedgerColumn[];
}

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
 * Two alternating tints, applied per account so each bucket's three columns
 * read as one block and the boundary between neighbouring accounts is visible.
 * Deliberately far weaker than any semantic color in the grid (the withdrawal
 * highlight, the loss/gain text) so it never competes with them for attention.
 */
const BUCKET_TINTS = ['bg-transparent', 'bg-surface-pressed'];

/** The order asset groups are rendered in - also the order tints alternate along. */
const ASSET_GROUP_ORDER = ['taxable', 'taxDeferred', 'taxFree'] as const;

const ASSET_GROUP_LABEL: Record<AccountBucket['taxTreatment'], string> = {
  taxable: 'Taxable Assets',
  taxDeferred: 'Tax-Deferred Assets',
  taxFree: 'Tax-Free Assets',
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

  function findOverride(year: number, field: string) {
    return overrides.find((o) => o.personId === personId && o.year === year && o.field === field);
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

  const isShared = (bucket: AccountBucket) => sharedBucketIds?.has(bucket.id) ?? false;
  const sharedBuckets = allBuckets.filter(isShared);
  const ownedBuckets = allBuckets.filter((b) => !isShared(b));

  // Shared accounts get their own group rather than being folded in by tax
  // treatment - they're not counted in any person's Total Net Worth, so
  // keeping them visually separate is what makes that total legible.
  const bucketsByTreatment: Partial<Record<AccountBucket['taxTreatment'], AccountBucket[]>> = {};
  for (const bucket of ownedBuckets) {
    (bucketsByTreatment[bucket.taxTreatment] ??= []).push(bucket);
  }

  // Tints must alternate in the order the columns are actually RENDERED, which
  // is by tax treatment and not the order `allBuckets` happens to be in (that's
  // grouped by person). Keying off allBuckets gave every person's RRSP the same
  // parity, so inside the Tax-Deferred group neighbouring accounts shared a tint
  // and the banding read as "per person" instead of "per account".
  const orderedBuckets = [...ASSET_GROUP_ORDER.flatMap((treatment) => bucketsByTreatment[treatment] ?? []), ...sharedBuckets];
  const tintByBucketId = new Map(orderedBuckets.map((bucket, i) => [bucket.id, i % BUCKET_TINTS.length]));

  /** The Start / Net Change / End trio rendered for any account, owned or shared. */
  function bucketColumns(bucket: AccountBucket): LedgerColumn[] {
    const tintIndex = tintByBucketId.get(bucket.id) ?? 0;
    const heading = bucketHeading(bucket, bucketOwnerLabels);
    const subHeader = (text: string) => (
      <span className="flex flex-col">
        <span>{heading}</span>
        <span className="text-[10px] font-normal normal-case text-dim">{text}</span>
      </span>
    );

    return [
      {
        id: `${bucket.id}-start`,
        tintIndex,
        header: subHeader('Start'),
        render: (row) => money.format(row.accountStart[bucket.id] ?? 0),
      },
      {
        id: `${bucket.id}-net`,
        tintIndex,
        // "Net Flow", not "Net Change": this is money moving in and out, which
        // is what was asked for - it deliberately excludes market growth, so
        // Start + this != End. The hover spells out all three legs so the row
        // still reconciles.
        header: subHeader('Net Flow'),
        render: (row) => {
          const withdrawal = row.withdrawals[bucket.id] ?? 0;
          const deposit = row.contributions[bucket.id] ?? 0;
          const growth = row.growth[bucket.id] ?? 0;
          const net = deposit - withdrawal;

          // Both legs shown on hover: a year can both draw from an account and
          // pay into it (a meltdown's proceeds landing where the buffer just
          // drew from), and the net alone would hide that entirely.
          const legs: string[] = [];
          if (withdrawal > 0) legs.push(`Withdrawn ${money.format(withdrawal)}`);
          if (deposit > 0) legs.push(`Deposited ${money.format(deposit)}`);
          if (growth !== 0) legs.push(`Growth ${money.format(growth)}`);
          const detail = legs.length > 0 ? legs.join(' · ') : 'No movement this year';

          if (withdrawal === 0 && deposit === 0) {
            return (
              <span title={detail} className="text-dim">
                —
              </span>
            );
          }

          const highlight = row.isRetired && withdrawal > 0;
          return (
            <span
              title={detail}
              className={cn(
                'inline-flex items-center gap-1',
                net < 0 ? 'text-loss' : 'text-gain',
                highlight && 'px-1.5 py-0.5 rounded-[6px] font-semibold bg-[#FEF3C7] text-[#92400E]',
              )}
            >
              {net > 0 ? '+' : net < 0 ? '−' : ''}
              {money.format(Math.abs(net))}
              {withdrawal > 0 && deposit > 0 && <span className="text-[9px] text-dim">↕</span>}
            </span>
          );
        },
      },
      {
        id: `${bucket.id}-end`,
        tintIndex,
        header: subHeader('End'),
        render: (row) => money.format(row.accountEnd[bucket.id] ?? 0),
      },
    ];
  }

  const { cashBuffer: cashBufferBuckets, taxable: taxableInvestmentBuckets, taxDeferred: taxDeferredInvestmentBuckets, taxFree: taxFreeInvestmentBuckets } = categorizeBuckets(allBuckets);
  const investmentBuckets = [...taxableInvestmentBuckets, ...taxDeferredInvestmentBuckets, ...taxFreeInvestmentBuckets];

  const groups: LedgerColumnGroup[] = [
    {
      key: 'expenses',
      label: 'Expenses',
      columns: [
        {
          id: 'spendingNominal',
          header: 'Nominal',
          render: (row) => {
            if (!allowOverrides) return money.format(row.spendingNominal);
            const override = findOverride(row.year, 'spendingNominal');
            return (
              <button
                type="button"
                className="flex items-center hover:underline decoration-dotted underline-offset-2 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditOverride(row);
                }}
              >
                {money.format(row.spendingNominal)}
                <Pencil className="ml-1 size-2.5 text-dim" />
                {override && <CellOverrideBadge />}
              </button>
            );
          },
        },
        { id: 'spendingReal', header: 'Real', render: (row) => money.format(row.spendingReal) },
      ],
    },
    {
      key: 'income',
      label: 'Income & Benefits',
      columns: [
        {
          id: 'incomes',
          header: 'Incomes',
          render: (row) => money.format(row.incomes.reduce((sum, i) => sum + i.amount, 0)),
        },
        {
          id: 'benefits',
          header: 'Benefits',
          render: (row) => money.format(row.benefits.reduce((sum, b) => sum + b.amount, 0)),
        },
      ],
    },
    ...(ASSET_GROUP_ORDER
      .map((treatment): LedgerColumnGroup | null => {
        const buckets = bucketsByTreatment[treatment];
        if (!buckets || buckets.length === 0) return null;
        return { key: treatment, label: ASSET_GROUP_LABEL[treatment], columns: buckets.flatMap(bucketColumns) };
      })
      .filter((g): g is LedgerColumnGroup => g !== null)),
    ...(sharedBuckets.length > 0
      ? [{ key: 'shared', label: 'Shared Accounts', columns: sharedBuckets.flatMap(bucketColumns) } satisfies LedgerColumnGroup]
      : []),
    {
      key: 'cashBuffer',
      label: 'Cash Buffer',
      columns: [{ id: 'cashBufferReplenishment', header: 'Replenishment', render: (row) => (row.cashBufferReplenishment > 0 ? money.format(row.cashBufferReplenishment) : '—') }],
    },
    {
      key: 'required',
      label: 'Required Distributions',
      columns: [
        {
          id: 'requiredDistributionTotal',
          header: 'Minimum',
          render: (row) => (row.requiredDistributionTotal > 0 ? money.format(row.requiredDistributionTotal) : '—'),
        },
      ],
    },
    {
      key: 'taxes',
      label: 'Taxes',
      columns: [
        { id: 'taxFederal', header: 'Federal', render: (row) => money.format(row.taxesPaid.federal) },
        { id: 'taxState', header: 'State/Prov.', render: (row) => money.format(row.taxesPaid.stateOrProvincial) },
        { id: 'taxTotal', header: 'Total', render: (row) => money.format(row.taxesPaid.total) },
      ],
    },
    {
      key: 'combined',
      label: 'Combined',
      columns: [
        { id: 'combined-cashBuffer', header: 'Total Cash', render: (row) => money.format(sumAccountEnd(row, cashBufferBuckets)) },
        { id: 'combined-taxable', header: 'Taxable Investments', render: (row) => money.format(sumAccountEnd(row, taxableInvestmentBuckets)) },
        { id: 'combined-taxDeferred', header: 'Tax-Deferred Investments', render: (row) => money.format(sumAccountEnd(row, taxDeferredInvestmentBuckets)) },
        { id: 'combined-taxFree', header: 'Tax-Free Investments', render: (row) => money.format(sumAccountEnd(row, taxFreeInvestmentBuckets)) },
        { id: 'combined-totalInvestments', header: 'Total Investments', render: (row) => money.format(sumAccountEnd(row, investmentBuckets)) },
      ],
    },
  ];

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
