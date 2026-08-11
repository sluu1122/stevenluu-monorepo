import { X } from 'lucide-react';
import { Button } from '@repo/ui/components/button';
import { cn } from '../../lib/utils';
import { formatCurrency } from '../../lib/format';
import type { MoneyFormatter } from '../../hooks/useDisplayCurrency';
import type { AccountBucket, Currency } from '../../engine/schema';
import type { LedgerYearRow } from '../../engine/types';

interface FormulaBreakdownPanelProps {
  row: LedgerYearRow;
  /** The currency the engine actually computed in - what this trail is denominated in. */
  baseCurrency: Currency;
  /** Every account visible in this view, so a flow can be named rather than shown as an id. */
  buckets: AccountBucket[];
  /** Owner prefixes for the combined view; omitted when looking at one person. */
  bucketOwnerLabels?: Record<string, string>;
  sharedBucketIds?: Set<string>;
  money: MoneyFormatter;
  onClose: () => void;
  /** Lets the mobile sheet drop the standalone panel's own border and rounding. */
  className?: string;
  /**
   * False inside the mobile Sheet, which renders its own close button in the
   * same corner - without this the two X icons sit on top of each other.
   */
  showClose?: boolean;
}

interface AccountFlow {
  id: string;
  label: string;
  start: number;
  withdrawal: number;
  contribution: number;
  growth: number;
  end: number;
}

/**
 * The per-year audit trail, as a pane beside the grid rather than an overlay
 * sheet - so a row's math stays on screen while you keep scrolling the grid to
 * compare it against neighbouring years.
 */
export function FormulaBreakdownPanel({
  row,
  baseCurrency,
  buckets,
  bucketOwnerLabels,
  sharedBucketIds,
  money,
  onClose,
  className,
  showClose = true,
}: FormulaBreakdownPanelProps) {
  // Only accounts that actually moved. A household with a dozen accounts
  // touches two or three in a typical year, and listing the dormant ones would
  // bury the ones that matter.
  const flows: AccountFlow[] = buckets
    .map((bucket) => ({
      id: bucket.id,
      label: bucketOwnerLabels?.[bucket.id] ? `${bucketOwnerLabels[bucket.id]} · ${bucket.label}` : bucket.label,
      start: row.accountStart[bucket.id] ?? 0,
      withdrawal: row.withdrawals[bucket.id] ?? 0,
      contribution: row.contributions[bucket.id] ?? 0,
      growth: row.growth[bucket.id] ?? 0,
      end: row.accountEnd[bucket.id] ?? 0,
    }))
    .filter((f) => Math.abs(f.withdrawal) > 0.005 || Math.abs(f.contribution) > 0.005);

  const totalOut = flows.reduce((sum, f) => sum + f.withdrawal, 0);
  const totalIn = flows.reduce((sum, f) => sum + f.contribution, 0);

  return (
    <aside className={cn('border border-edge rounded-[14px] bg-surface flex flex-col min-h-0 w-full lg:w-[380px] lg:shrink-0', className)}>
      <div className="flex items-start justify-between gap-2 px-4 py-3 border-b border-edge shrink-0">
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold text-ink">
            {row.year} (age {row.age})
          </h3>
          <p className="text-[11.5px] text-dim leading-snug">
            Every value computed this row, in calculation order.
            {/*
              Left in the engine's own currency even when the grid is showing
              the other one: a step's `inputs` are raw operands, and not all of
              them are money (ages, rates, counts). Converting the result but
              not those would make every formula here fail to add up.
            */}
            {money.isConverted && <span className="block mt-0.5">Shown in {baseCurrency}, the currency this plan is calculated in.</span>}
          </p>
        </div>
        {showClose && (
          <Button type="button" variant="ghost" size="icon" className="cursor-pointer size-9 sm:size-7 shrink-0 text-dim hover:text-ink" onClick={onClose} aria-label="Close breakdown">
            <X className="size-4" />
          </Button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        {/* Where the money actually went, before the formulas that decided it.
            The audit trail below explains each step in isolation; this is the
            one place the year reads as a single set of books. */}
        <section>
          <h4 className="text-[12px] font-semibold uppercase tracking-[0.04em] text-slate mb-2">Money moved this year</h4>
          {flows.length === 0 ? (
            <p className="text-[13px] text-dim">No account was drawn on or paid into this year.</p>
          ) : (
            <>
              <ul className="flex flex-col gap-1.5">
                {flows.map((flow) => (
                  <li key={flow.id} className="rounded-[10px] border border-edge bg-surface-muted px-3 py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[12.5px] font-medium text-ink truncate">
                        {flow.label}
                        {sharedBucketIds?.has(flow.id) && <span className="text-dim font-normal"> · shared</span>}
                      </span>
                      <span className={`text-[13px] font-mono font-semibold shrink-0 ${flow.contribution - flow.withdrawal >= 0 ? 'text-gain-dark' : 'text-loss'}`}>
                        {flow.contribution - flow.withdrawal >= 0 ? '+' : '−'}
                        {formatCurrency(Math.abs(flow.contribution - flow.withdrawal), baseCurrency)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate font-mono">
                      {flow.withdrawal > 0.005 && <span className="text-loss">out {formatCurrency(flow.withdrawal, baseCurrency)}</span>}
                      {flow.contribution > 0.005 && <span className="text-gain-dark">in {formatCurrency(flow.contribution, baseCurrency)}</span>}
                      <span className="text-dim">
                        {formatCurrency(flow.start, baseCurrency)} → {formatCurrency(flow.end, baseCurrency)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex items-center justify-between gap-2 text-[11.5px] text-slate px-1">
                <span>
                  <span className="text-loss font-mono">{formatCurrency(totalOut, baseCurrency)}</span> out ·{' '}
                  <span className="text-gain-dark font-mono">{formatCurrency(totalIn, baseCurrency)}</span> in
                </span>
                <span className="text-dim">across {flows.length} account{flows.length === 1 ? '' : 's'}</span>
              </div>
            </>
          )}
        </section>

        <h4 className="text-[12px] font-semibold uppercase tracking-[0.04em] text-slate mt-2">Calculation trail</h4>
        {row.audit.steps.length === 0 && <p className="text-[13px] text-dim">Nothing to compute this year.</p>}
        {row.audit.steps.map((step, index) => (
          <div key={index} className="rounded-[10px] border border-edge bg-surface-muted px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-ink">{step.label}</span>
              <span className="text-[13px] font-mono font-semibold text-indigo">{formatCurrency(step.result, baseCurrency)}</span>
            </div>
            <p className="mt-1 text-[11.5px] font-mono text-dim break-words">{step.formula}</p>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate">
              {Object.entries(step.inputs).map(([key, val]) => (
                <span key={key}>
                  {key}: <span className="font-mono">{Number.isFinite(val) ? val.toLocaleString() : '∞'}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
