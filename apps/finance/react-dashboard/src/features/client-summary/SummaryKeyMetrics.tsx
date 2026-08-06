import { DashCard } from '../../components/DashCard';
import type { MoneyFormatter } from '../../hooks/useDisplayCurrency';
import { cn } from '../../lib/utils';
import type { LedgerYearRow } from '../../engine/types';

interface SummaryKeyMetricsProps {
  rows: LedgerYearRow[];
  money: MoneyFormatter;
  retirementStartYear: number | null;
  hasShortfall: boolean;
}

/** Scales the value down as it gets longer, so a large formatted currency figure doesn't overflow or force the card wider. */
function valueTextSizeClass(value: string): string {
  if (value.length >= 14) return 'text-[15px]';
  if (value.length >= 10) return 'text-[18px]';
  return 'text-[22px]';
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'gain' | 'loss' }) {
  return (
    <DashCard className="py-4">
      {/* Fixed to two lines' worth of height regardless of whether THIS label
          actually wraps, so the value below it lines up across every card in
          the row - a short label and a long one both start their value at
          the same y position instead of the long one pushing its value down. */}
      <p className="dash-label mb-1.5 min-h-[30px] leading-[15px]">{label}</p>
      <p
        title={value}
        className={cn('font-semibold tracking-[-0.01em] truncate', valueTextSizeClass(value), tone === 'loss' ? 'text-loss' : tone === 'gain' ? 'text-gain' : 'text-ink')}
      >
        {value}
      </p>
    </DashCard>
  );
}

export function SummaryKeyMetrics({ rows, money, retirementStartYear, hasShortfall }: SummaryKeyMetricsProps) {
  const startingNetWorth = rows[0]?.totalNetWorth ?? 0;
  const endingRow = rows.at(-1);
  const peakRow = rows.reduce((max, row) => (row.totalNetWorth > (max?.totalNetWorth ?? -Infinity) ? row : max), rows[0]);
  const totalTaxesPaid = rows.reduce((sum, row) => sum + row.taxesPaid.total, 0);
  const yearsInRetirement = rows.filter((r) => r.isRetired).length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <Metric label="Retirement Start" value={retirementStartYear ? String(retirementStartYear) : 'Not set'} />
      <Metric label="Years in Retirement" value={String(yearsInRetirement)} />
      <Metric label="Starting Net Worth" value={money.format(startingNetWorth)} />
      <Metric label={`Net Worth in ${endingRow?.year ?? '—'}`} value={money.format(endingRow?.totalNetWorth ?? 0)} tone={hasShortfall ? 'loss' : 'gain'} />
      <Metric label={`Peak Net Worth (${peakRow?.year ?? '—'})`} value={money.format(peakRow?.totalNetWorth ?? 0)} tone="gain" />
      <Metric label="Lifetime Taxes Paid" value={money.format(totalTaxesPaid)} />
    </div>
  );
}
