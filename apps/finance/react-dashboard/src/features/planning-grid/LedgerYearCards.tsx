import { useState } from 'react';
import { ChevronDown, FileText } from 'lucide-react';
import { Button } from '@repo/ui/components/button';
import { buildLedgerColumns } from './ledgerColumns';
import { cn } from '../../lib/utils';
import type { MoneyFormatter } from '../../hooks/useDisplayCurrency';
import type { AccountBucket, GridOverride } from '../../engine/schema';
import type { LedgerYearRow } from '../../engine/types';

interface LedgerYearCardsProps {
  money: MoneyFormatter;
  buckets: AccountBucket[];
  bucketOwnerLabels?: Record<string, string>;
  sharedBucketIds?: Set<string>;
  rows: LedgerYearRow[];
  overrides: GridOverride[];
  personId: string | null;
  allowOverrides: boolean;
  selectedYear: number | null;
  onOpenAudit: (row: LedgerYearRow) => void;
  onEditOverride: (row: LedgerYearRow) => void;
}

/**
 * The Planning Grid below `lg`, where the table's 30-48 columns can't work: at
 * 375px its three frozen columns alone eat half the screen.
 *
 * Every value the table shows is still reachable - the card header carries the
 * three frozen columns, the headline carries Total Net Worth, and expanding
 * walks the same `buildLedgerColumns` model the table renders, so neither view
 * can drift from the other on formatting, ordering, or which accounts appear.
 *
 * Deliberately not virtualized: 60 collapsed cards is roughly 600 nodes against
 * the table's ~1,800 cells, so this is already the lighter of the two. A
 * virtualizer would add a dependency, need variable-height measurement for
 * expanded cards, and break find-in-page.
 */
export function LedgerYearCards({
  money,
  buckets,
  bucketOwnerLabels,
  sharedBucketIds,
  rows,
  overrides,
  personId,
  allowOverrides,
  selectedYear,
  onOpenAudit,
  onEditOverride,
}: LedgerYearCardsProps) {
  // Multiple open at once: comparing two years is a real thing to want, and
  // nobody can physically expand all sixty.
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());

  const groups = buildLedgerColumns({ money, buckets, bucketOwnerLabels, sharedBucketIds, overrides, personId, allowOverrides, onEditOverride });
  const spendingColumn = groups.find((g) => g.key === 'expenses')?.columns.find((c) => c.id === 'spendingNominal');

  function toggle(year: number) {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  }

  return (
    <ol className="flex flex-col gap-2 list-none">
      {rows.map((row) => {
        const expanded = expandedYears.has(row.year);
        const selected = selectedYear === row.year;

        return (
          <li key={row.year} className={cn('border rounded-[14px] bg-surface overflow-hidden', selected ? 'border-indigo' : 'border-edge')}>
            <button
              type="button"
              aria-expanded={expanded}
              className="w-full flex items-center gap-3 px-3.5 py-3 text-left cursor-pointer hover:bg-surface-pressed transition-colors"
              onClick={() => toggle(row.year)}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[15px] font-semibold text-ink">{row.year}</span>
                  <span className="text-[12px] text-dim">age {row.age}</span>
                  {row.isRetired && <span className="text-[10px] uppercase tracking-[0.06em] font-semibold text-indigo bg-indigo-bg rounded-full px-1.5 py-0.5">Retired</span>}
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-[11.5px] text-dim">Net worth</span>
                  <span className="text-[14px] font-semibold font-mono text-ink">{money.format(row.totalNetWorth)}</span>
                </div>
              </div>
              <ChevronDown className={cn('size-4 shrink-0 text-dim transition-transform', expanded && 'rotate-180')} />
            </button>

            {/* Spending sits outside the expander because editing it is the main
                reason to open this tab at all - rendered through the shared
                column so the override pencil and badge come along with it. */}
            {spendingColumn && (
              <div className="flex items-baseline justify-between gap-3 px-3.5 pb-3 text-[12.5px]">
                <span className="text-dim">Spending</span>
                <span className="font-mono text-ink">{spendingColumn.render(row)}</span>
              </div>
            )}

            {expanded && (
              <div className="border-t border-edge px-3.5 py-3 flex flex-col gap-3.5">
                {groups.map((group) => (
                  <section key={group.key}>
                    <h4 className="text-[12px] font-semibold uppercase tracking-[0.04em] text-slate mb-1.5">{group.label}</h4>
                    <dl className="flex flex-col gap-1">
                      {group.columns.map((column) => (
                        <div key={column.id} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                          <dt className="text-dim min-w-0 truncate">{column.label}</dt>
                          <dd className="font-mono text-ink shrink-0">{column.render(row)}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                ))}

                <Button type="button" variant="outline" className="cursor-pointer w-full" onClick={() => onOpenAudit(row)}>
                  <FileText className="size-4" /> Show calculation
                </Button>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
