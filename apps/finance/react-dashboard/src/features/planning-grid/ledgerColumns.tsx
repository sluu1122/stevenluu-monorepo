import type { ReactNode } from 'react';
import { Pencil } from 'lucide-react';
import { CellOverrideBadge } from './CellOverrideBadge';
import { cn } from '../../lib/utils';
import { bucketHeading, categorizeBuckets, sumAccountEnd } from '../../lib/investmentCategories';
import type { MoneyFormatter } from '../../hooks/useDisplayCurrency';
import type { AccountBucket, GridOverride } from '../../engine/schema';
import type { LedgerYearRow } from '../../engine/types';

export interface LedgerColumn {
  id: string;
  /**
   * Flat text name, always a plain string.
   *
   * `header` can be arbitrary JSX (bucket columns render a two-line stack), so
   * a consumer that needs the name as text - the mobile card view, which lays
   * each column out as a label/value pair - can't reuse it. Set alongside
   * `header` at the same call site so the two can't drift apart.
   */
  label: string;
  header: ReactNode;
  render: (row: LedgerYearRow) => ReactNode;
  /** Tints a whole account's column run so its Start/Net/End read as one unit. */
  tintIndex?: number;
}

export interface LedgerColumnGroup {
  key: string;
  label: string;
  columns: LedgerColumn[];
}

/**
 * Two alternating tints, applied per account so each bucket's three columns
 * read as one block and the boundary between neighbouring accounts is visible.
 * Deliberately far weaker than any semantic color in the grid (the withdrawal
 * highlight, the loss/gain text) so it never competes with them for attention.
 */
export const BUCKET_TINTS = ['bg-transparent', 'bg-surface-pressed'];

/** The order asset groups are rendered in - also the order tints alternate along. */
const ASSET_GROUP_ORDER = ['taxable', 'taxDeferred', 'taxFree'] as const;

const ASSET_GROUP_LABEL: Record<AccountBucket['taxTreatment'], string> = {
  taxable: 'Taxable Assets',
  taxDeferred: 'Tax-Deferred Assets',
  taxFree: 'Tax-Free Assets',
};

export interface BuildLedgerColumnsInput {
  money: MoneyFormatter;
  buckets: AccountBucket[];
  /** Set only in the combined view, where two people can own identically-named accounts. */
  bucketOwnerLabels?: Record<string, string>;
  /** Jointly-held buckets, grouped separately since nobody's Total Net Worth claims them. */
  sharedBucketIds?: Set<string>;
  overrides: GridOverride[];
  personId: string | null;
  allowOverrides: boolean;
  onEditOverride: (row: LedgerYearRow) => void;
}

/**
 * The single description of every cell in the planning grid, shared by the
 * desktop table and the mobile card list so neither can drift from the other
 * on formatting, ordering, or which accounts appear.
 *
 * Deliberately not memoized: this is a pure function of its arguments and was
 * built inline on every render before being extracted, so calling it is a
 * behavioural no-op. `money` and `onEditOverride` arrive as fresh identities
 * each render anyway, so a memo would near-never hit, and a wrong dep list
 * would serve stale `overrides` and silently freeze the override badges.
 */
export function buildLedgerColumns({
  money,
  buckets: allBuckets,
  bucketOwnerLabels,
  sharedBucketIds,
  overrides,
  personId,
  allowOverrides,
  onEditOverride,
}: BuildLedgerColumnsInput): LedgerColumnGroup[] {
  function findOverride(year: number, field: string) {
    return overrides.find((o) => o.personId === personId && o.year === year && o.field === field);
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
        label: `${heading} Start`,
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
        label: `${heading} Net Flow`,
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
        label: `${heading} End`,
        header: subHeader('End'),
        render: (row) => money.format(row.accountEnd[bucket.id] ?? 0),
      },
    ];
  }

  const { cashBuffer: cashBufferBuckets, taxable: taxableInvestmentBuckets, taxDeferred: taxDeferredInvestmentBuckets, taxFree: taxFreeInvestmentBuckets } = categorizeBuckets(allBuckets);
  const investmentBuckets = [...taxableInvestmentBuckets, ...taxDeferredInvestmentBuckets, ...taxFreeInvestmentBuckets];

  return [
    {
      key: 'expenses',
      label: 'Expenses',
      columns: [
        {
          id: 'spendingNominal',
          label: 'Nominal',
          header: 'Nominal',
          render: (row) => {
            if (!allowOverrides) return money.format(row.spendingNominal);
            const override = findOverride(row.year, 'spendingNominal');
            return (
              <button
                type="button"
                aria-label={`Override ${row.year} spending`}
                // The visible target is only the text plus a tiny pencil; the
                // inset pseudo-element grows the hit area to something usable
                // on touch without changing what the cell measures.
                className="relative flex items-center hover:underline decoration-dotted underline-offset-2 cursor-pointer after:absolute after:-inset-2.5 after:content-['']"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditOverride(row);
                }}
              >
                {money.format(row.spendingNominal)}
                <Pencil className="ml-1 size-3 text-dim" />
                {override && <CellOverrideBadge />}
              </button>
            );
          },
        },
        { id: 'spendingReal', label: 'Real', header: 'Real', render: (row) => money.format(row.spendingReal) },
      ],
    },
    {
      key: 'income',
      label: 'Income & Benefits',
      columns: [
        {
          id: 'incomes',
          label: 'Incomes',
          header: 'Incomes',
          render: (row) => money.format(row.incomes.reduce((sum, i) => sum + i.amount, 0)),
        },
        {
          id: 'benefits',
          label: 'Benefits',
          header: 'Benefits',
          render: (row) => money.format(row.benefits.reduce((sum, b) => sum + b.amount, 0)),
        },
      ],
    },
    ...ASSET_GROUP_ORDER.map((treatment): LedgerColumnGroup | null => {
      const buckets = bucketsByTreatment[treatment];
      if (!buckets || buckets.length === 0) return null;
      return { key: treatment, label: ASSET_GROUP_LABEL[treatment], columns: buckets.flatMap(bucketColumns) };
    }).filter((g): g is LedgerColumnGroup => g !== null),
    ...(sharedBuckets.length > 0
      ? [{ key: 'shared', label: 'Shared Accounts', columns: sharedBuckets.flatMap(bucketColumns) } satisfies LedgerColumnGroup]
      : []),
    {
      key: 'cashBuffer',
      label: 'Cash Buffer',
      columns: [
        {
          id: 'cashBufferReplenishment',
          label: 'Replenishment',
          header: 'Replenishment',
          render: (row) => (row.cashBufferReplenishment > 0 ? money.format(row.cashBufferReplenishment) : '—'),
        },
      ],
    },
    {
      key: 'required',
      label: 'Required Distributions',
      columns: [
        {
          id: 'requiredDistributionTotal',
          label: 'Minimum',
          header: 'Minimum',
          render: (row) => (row.requiredDistributionTotal > 0 ? money.format(row.requiredDistributionTotal) : '—'),
        },
      ],
    },
    {
      key: 'taxes',
      label: 'Taxes',
      columns: [
        { id: 'taxFederal', label: 'Federal', header: 'Federal', render: (row) => money.format(row.taxesPaid.federal) },
        { id: 'taxState', label: 'State/Prov.', header: 'State/Prov.', render: (row) => money.format(row.taxesPaid.stateOrProvincial) },
        { id: 'taxTotal', label: 'Total', header: 'Total', render: (row) => money.format(row.taxesPaid.total) },
      ],
    },
    {
      key: 'combined',
      label: 'Combined',
      columns: [
        { id: 'combined-cashBuffer', label: 'Total Cash', header: 'Total Cash', render: (row) => money.format(sumAccountEnd(row, cashBufferBuckets)) },
        { id: 'combined-taxable', label: 'Taxable Investments', header: 'Taxable Investments', render: (row) => money.format(sumAccountEnd(row, taxableInvestmentBuckets)) },
        {
          id: 'combined-taxDeferred',
          label: 'Tax-Deferred Investments',
          header: 'Tax-Deferred Investments',
          render: (row) => money.format(sumAccountEnd(row, taxDeferredInvestmentBuckets)),
        },
        { id: 'combined-taxFree', label: 'Tax-Free Investments', header: 'Tax-Free Investments', render: (row) => money.format(sumAccountEnd(row, taxFreeInvestmentBuckets)) },
        { id: 'combined-totalInvestments', label: 'Total Investments', header: 'Total Investments', render: (row) => money.format(sumAccountEnd(row, investmentBuckets)) },
      ],
    },
  ];
}
