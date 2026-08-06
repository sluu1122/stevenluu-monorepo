import type { AccountBucket, Scenario } from '../../engine/schema';
import type { LedgerYearRow } from '../../engine/types';
import type { MoneyFormatter } from '../../hooks/useDisplayCurrency';
import { bucketHeading } from '../../lib/investmentCategories';
import { slugify } from '../client-summary/exportPlainTextSummary';

export interface GridCsvView {
  /** The accounts behind these rows - one person's, or everyone's when combined. */
  buckets: AccountBucket[];
  bucketOwnerLabels?: Record<string, string>;
  sharedBucketIds?: Set<string>;
  /** The person's name, or "Combined". */
  viewLabel: string;
  /**
   * Writes the file in whatever currency the grid is currently displaying, so
   * exporting never silently hands back different units than the screen showed.
   * The chosen currency goes in the filename, since a flat CSV has nowhere else
   * to record it.
   */
  money: Pick<MoneyFormatter, 'currency' | 'convert'>;
}

const TAX_TREATMENT_ORDER: AccountBucket['taxTreatment'][] = ['taxable', 'taxDeferred', 'taxFree'];

function csvEscape(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsvFile(filename: string, content: string): void {
  // Led with a UTF-8 BOM: bucket labels are owner-prefixed with a "·", and
  // Excel on Windows reads a CSV in the system ANSI codepage unless a BOM
  // says otherwise - without it the separator arrives as "Â·".
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const num = (n: number) => n.toFixed(2);

/**
 * Rounds to cents the same way `num` prints, so a total derived from already-
 * rounded components matches what those components show in the file.
 */
const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * A plain-numbers CSV of the Planning Grid, in the same column order and
 * grouping it displays on screen - owned buckets by tax treatment, then
 * shared accounts. Values are unrounded, unformatted numbers rather than
 * `formatCurrency` output, so the file is directly diffable and parseable
 * by a spreadsheet or another system cross-checking the engine's output.
 */
export function buildGridCsv(rows: LedgerYearRow[], view: GridCsvView): string {
  // Convert BEFORE rounding to cents, so the printed components are whole cents
  // in the currency actually written and their printed total still closes.
  const conv = view.money.convert;
  const money = (n: number) => num(conv(n));
  const isShared = (bucket: AccountBucket) => view.sharedBucketIds?.has(bucket.id) ?? false;
  const ownedBuckets = view.buckets.filter((b) => !isShared(b));
  const sharedBuckets = view.buckets.filter(isShared);
  const orderedOwnedBuckets = TAX_TREATMENT_ORDER.flatMap((treatment) => ownedBuckets.filter((b) => b.taxTreatment === treatment));
  const bucketColumns = [...orderedOwnedBuckets, ...sharedBuckets];

  // The grid separates joint accounts into their own column group; a flat CSV
  // can't, so the label carries it instead. This matters for more than
  // cosmetics: on a single person's export a joint account shows household
  // Start/End but only that person's own flows, so
  // "End = Start - Withdrawal + Contribution + Growth" holds for it only in
  // the combined export. Without the prefix a reader has no way to know which
  // accounts that caveat applies to.
  const ownerLabels: Record<string, string> = { ...view.bucketOwnerLabels };
  for (const bucket of sharedBuckets) ownerLabels[bucket.id] ??= 'Shared';

  const headers = [
    'Age',
    'Year',
    'YearsToOrInRetirement',
    'NominalSpending',
    'RealSpending',
    'TotalIncome',
    'TotalBenefits',
    // Start/Withdrawal/End are what the grid shows; Contribution and Growth are
    // the remaining two legs of the year, exported so a reader can verify
    // End = Start - Withdrawal + Contribution + Growth per account without
    // needing the engine. Contribution includes cash-buffer replenishment
    // landing in the bucket, which is the credit side of another account's
    // withdrawal in the same row.
    ...bucketColumns.flatMap((bucket) => {
      const label = bucketHeading(bucket, ownerLabels);
      return [`${label} Start`, `${label} Withdrawal`, `${label} Contribution`, `${label} Growth`, `${label} End`];
    }),
    'CashBufferReplenishment',
    'RequiredDistributionTotal',
    'FederalTax',
    'StateOrProvincialTax',
    'TotalTax',
    'MeltdownWithdrawalTotal',
    'TotalNetWorth',
  ];

  const lines = [headers.map(csvEscape).join(',')];

  for (const row of rows) {
    const totalIncome = row.incomes.reduce((sum, i) => sum + i.amount, 0);
    const totalBenefits = row.benefits.reduce((sum, b) => sum + b.amount, 0);
    const federalTax = cents(conv(row.taxesPaid.federal));
    const stateOrProvincialTax = cents(conv(row.taxesPaid.stateOrProvincial));

    const cells: (string | number)[] = [
      row.age,
      row.year,
      Number.isNaN(row.yearsToOrInRetirement) ? '' : row.yearsToOrInRetirement,
      money(row.spendingNominal),
      money(row.spendingReal),
      money(totalIncome),
      money(totalBenefits),
      ...bucketColumns.flatMap((bucket) => [
        money(row.accountStart[bucket.id] ?? 0),
        money(row.withdrawals[bucket.id] ?? 0),
        money(row.contributions[bucket.id] ?? 0),
        money(row.growth[bucket.id] ?? 0),
        money(row.accountEnd[bucket.id] ?? 0),
      ]),
      money(row.cashBufferReplenishment),
      money(row.requiredDistributionTotal),
      // The engine's total is exact (federal + stateOrProvincial, unrounded),
      // but rounding all three to cents independently lets the printed row
      // disagree with itself by a cent. Round the components once, then derive
      // the printed total from them, so the file's own arithmetic closes.
      num(federalTax),
      num(stateOrProvincialTax),
      num(federalTax + stateOrProvincialTax),
      money(row.meltdownWithdrawalTotal),
      money(row.totalNetWorth),
    ];

    lines.push(cells.map(csvEscape).join(','));
  }

  return lines.join('\n');
}

export function exportGridCsv(scenario: Scenario, rows: LedgerYearRow[], view: GridCsvView): void {
  const slug = slugify(scenario.name, 'scenario');
  const viewSlug = slugify(view.viewLabel, 'view');
  const filename = `${slug}-${viewSlug}-grid-${view.money.currency.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
  downloadCsvFile(filename, buildGridCsv(rows, view));
}
