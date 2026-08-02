import { DashCard } from '../../components/DashCard';
import { formatCurrency } from '../../lib/format';
import type { LedgerYearRow } from '../../engine/types';
import type { Currency } from '../../engine/schema';

interface SummaryKeyMetricsProps {
  rows: LedgerYearRow[];
  currency: Currency;
  retirementStartYear: number | null;
  hasShortfall: boolean;
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'gain' | 'loss' }) {
  return (
    <DashCard className="py-4">
      <p className="dash-label mb-1.5">{label}</p>
      <p className={`text-[22px] font-semibold tracking-[-0.01em] ${tone === 'loss' ? 'text-loss' : tone === 'gain' ? 'text-gain' : 'text-ink'}`}>{value}</p>
    </DashCard>
  );
}

export function SummaryKeyMetrics({ rows, currency, retirementStartYear, hasShortfall }: SummaryKeyMetricsProps) {
  const startingNetWorth = rows[0]?.totalNetWorth ?? 0;
  const endingRow = rows.at(-1);
  const peakRow = rows.reduce((max, row) => (row.totalNetWorth > (max?.totalNetWorth ?? -Infinity) ? row : max), rows[0]);
  const totalTaxesPaid = rows.reduce((sum, row) => sum + row.taxesPaid.total, 0);
  const yearsInRetirement = rows.filter((r) => r.isRetired).length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <Metric label="Retirement Start" value={retirementStartYear ? String(retirementStartYear) : 'Not set'} />
      <Metric label="Years in Retirement" value={String(yearsInRetirement)} />
      <Metric label="Starting Net Worth" value={formatCurrency(startingNetWorth, currency)} />
      <Metric label={`Net Worth in ${endingRow?.year ?? '—'}`} value={formatCurrency(endingRow?.totalNetWorth ?? 0, currency)} tone={hasShortfall ? 'loss' : 'gain'} />
      <Metric label={`Peak Net Worth (${peakRow?.year ?? '—'})`} value={formatCurrency(peakRow?.totalNetWorth ?? 0, currency)} tone="gain" />
      <Metric label="Lifetime Taxes Paid" value={formatCurrency(totalTaxesPaid, currency)} />
    </div>
  );
}
