import type { AccountBucket, Scenario } from '../../engine/schema';
import type { LedgerYearRow } from '../../engine/types';
import type { MoneyFormatter } from '../../hooks/useDisplayCurrency';
import { categorizeBuckets, sumAccountEnd } from '../../lib/investmentCategories';

export interface PlainTextSummaryView {
  /** The accounts behind these rows - one person's, or everyone's when combined. */
  buckets: AccountBucket[];
  /** The person's name, or "Combined". */
  viewLabel: string;
  retirementStartYear: number | null;
  combined: boolean;
  /**
   * Renders the file in whatever currency the tab is currently displaying, so
   * exporting never silently hands back different units than the screen showed.
   */
  money: Pick<MoneyFormatter, 'currency' | 'convert' | 'isConverted'>;
}

const DETAIL_HEADERS = [
  'Year',
  'Age',
  'Status',
  'NominalSpending',
  'RealSpending',
  'TotalIncome',
  'TotalBenefits',
  'FederalTax',
  'StateOrProvincialTax',
  'TotalTax',
  'CashBuffer',
  'TaxableInvestments',
  'TaxDeferredInvestments',
  'TaxFreeInvestments',
  'TotalInvestments',
  'TotalNetWorth',
];

function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * A tab-separated, whole-dollar plain-text dump of the full ledger - meant
 * for another system (or a spreadsheet) to independently re-derive and
 * cross-check the numbers shown in the UI, not for reading as prose.
 */
export function buildPlainTextSummary(scenario: Scenario, rows: LedgerYearRow[], view: PlainTextSummaryView): string {
  const categories = categorizeBuckets(view.buckets);
  const investmentBuckets = [...categories.taxable, ...categories.taxDeferred, ...categories.taxFree];
  // Every figure below goes through this, so the file's units always match the
  // "Currency:" line - and the whole-dollar rounding stays the last step.
  const money = (value: number) => Math.round(view.money.convert(value));

  const startingNetWorth = rows[0]?.totalNetWorth ?? 0;
  const endingRow = rows.at(-1);
  const peakRow = rows.reduce((max, r) => (r.totalNetWorth > (max?.totalNetWorth ?? -Infinity) ? r : max), rows[0]);
  const totalTaxesPaid = rows.reduce((sum, r) => sum + r.taxesPaid.total, 0);

  const lines: string[] = [];
  lines.push('RETIREMENT PLAN SUMMARY');
  lines.push(`Scenario: ${scenario.name}`);
  lines.push(`View: ${view.viewLabel}${view.combined ? ' (all persons summed)' : ''}`);
  lines.push(`Tax residency: ${scenario.country === 'US' ? 'United States' : 'Canada'}`);
  lines.push(`Currency: ${view.money.currency}${view.money.isConverted ? ` (converted from ${scenario.currency} at ${scenario.exchangeRateUsdToCad})` : ''}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('DISCLAIMER: Demo output only. Figures may be inaccurate. Not financial advice.');
  lines.push('');
  lines.push('KEY METRICS');
  lines.push(`Retirement start year: ${view.retirementStartYear ?? 'Not set'}`);
  lines.push(`Years in retirement: ${rows.filter((r) => r.isRetired).length}`);
  lines.push(`Starting net worth: ${money(startingNetWorth)}`);
  lines.push(`Net worth in ${endingRow?.year ?? 'n/a'}: ${money(endingRow?.totalNetWorth ?? 0)}`);
  lines.push(`Peak net worth (${peakRow?.year ?? 'n/a'}): ${money(peakRow?.totalNetWorth ?? 0)}`);
  lines.push(`Lifetime taxes paid: ${money(totalTaxesPaid)}`);
  lines.push('');
  lines.push('YEAR-BY-YEAR DETAIL (tab-separated, whole dollars)');
  lines.push(DETAIL_HEADERS.join('\t'));

  for (const row of rows) {
    const totalIncome = row.incomes.reduce((sum, i) => sum + i.amount, 0);
    const totalBenefits = row.benefits.reduce((sum, b) => sum + b.amount, 0);
    const cashBuffer = sumAccountEnd(row, categories.cashBuffer);
    const taxable = sumAccountEnd(row, categories.taxable);
    const taxDeferred = sumAccountEnd(row, categories.taxDeferred);
    const taxFree = sumAccountEnd(row, categories.taxFree);
    const totalInvestments = sumAccountEnd(row, investmentBuckets);

    lines.push(
      [
        row.year,
        row.age,
        row.isRetired ? 'Retired' : 'Working',
        money(row.spendingNominal),
        money(row.spendingReal),
        money(totalIncome),
        money(totalBenefits),
        money(row.taxesPaid.federal),
        money(row.taxesPaid.stateOrProvincial),
        money(row.taxesPaid.total),
        money(cashBuffer),
        money(taxable),
        money(taxDeferred),
        money(taxFree),
        money(totalInvestments),
        money(row.totalNetWorth),
      ].join('\t'),
    );
  }

  return lines.join('\n');
}

export function slugify(value: string, fallback: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || fallback;
}

export function exportPlainTextSummary(scenario: Scenario, rows: LedgerYearRow[], view: PlainTextSummaryView): void {
  const slug = slugify(scenario.name, 'scenario');
  const viewSlug = slugify(view.viewLabel, 'view');
  const filename = `${slug}-${viewSlug}-summary-${new Date().toISOString().slice(0, 10)}.txt`;
  downloadTextFile(filename, buildPlainTextSummary(scenario, rows, view));
}
