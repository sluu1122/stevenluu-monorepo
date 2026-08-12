import { AreaChart, CartesianGrid } from 'recharts';
import { ChartContainer, ChartTooltip, type ChartConfig } from '@repo/ui/components/chart';
import { CompatArea, CompatXAxis, CompatYAxis } from '@repo/ui/lib/rechartsCompat';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { formatCompactCurrency } from '../../lib/format';
import { categorizeBuckets, sumAccountEnd } from '../../lib/investmentCategories';
import type { MoneyFormatter } from '../../hooks/useDisplayCurrency';
import type { LedgerYearRow } from '../../engine/types';
import { NOMINAL, type Deflate } from '../../lib/realTerms';
import type { AccountBucket } from '../../engine/schema';

interface NetWorthOverTimeChartProps {
  rows: LedgerYearRow[];
  buckets: AccountBucket[];
  money: MoneyFormatter;
  /** Re-expresses each figure in today's dollars. Identity when showing nominal. */
  deflate?: Deflate;
}

interface NetWorthPoint {
  year: number;
  age: number;
  totalNetWorth: number;
  cashBuffer: number;
  taxable: number;
  taxDeferred: number;
  taxFree: number;
  totalInvestments: number;
}

// Single series - the chart title names it, so no legend per the dataviz skill's rule.
const chartConfig: ChartConfig = {
  totalNetWorth: { label: 'Total Net Worth', color: 'var(--chart-1)' },
};

export function NetWorthOverTimeChart({ rows, buckets, money, deflate = NOMINAL }: NetWorthOverTimeChartProps) {
  const isMobile = useIsMobile();

  const categories = categorizeBuckets(buckets);
  const investmentBuckets = [...categories.taxable, ...categories.taxDeferred, ...categories.taxFree];

  // Converted here, at the point the series is built, rather than in the
  // formatters - so Recharts picks its axis ticks from display-currency values
  // and they land on round numbers instead of converted-from-round ones.
  // Currency conversion and inflation adjustment are both scalar, so the order
  // between them doesn't matter - applied together here at the render boundary.
  const show = (row: LedgerYearRow, value: number) => deflate(money.convert(value), row.year);

  const data: NetWorthPoint[] = rows.map((row) => ({
    year: row.year,
    age: row.age,
    totalNetWorth: show(row, row.totalNetWorth),
    cashBuffer: show(row, sumAccountEnd(row, categories.cashBuffer)),
    taxable: show(row, sumAccountEnd(row, categories.taxable)),
    taxDeferred: show(row, sumAccountEnd(row, categories.taxDeferred)),
    taxFree: show(row, sumAccountEnd(row, categories.taxFree)),
    totalInvestments: show(row, sumAccountEnd(row, investmentBuckets)),
  }));

  // The breakdown rows (cash buffer, taxable, etc.) aren't separately plotted
  // series - the chart only draws one Area (Total Net Worth) - so this is a
  // fully custom tooltip rather than the shared ChartTooltipContent, which
  // can only render rows for series Recharts actually plotted.
  function renderTooltip({ active, payload }: { active?: boolean; payload?: { payload: NetWorthPoint }[] }) {
    if (!active || !payload?.length) return null;
    const point = payload[0]?.payload;
    if (!point) return null;

    const breakdownRows: { label: string; value: number }[] = [
      { label: 'Cash Buffer', value: point.cashBuffer },
      { label: 'Taxable Investments', value: point.taxable },
      { label: 'Tax-Deferred Investments', value: point.taxDeferred },
      { label: 'Tax-Free Investments', value: point.taxFree },
      { label: 'Total Investments', value: point.totalInvestments },
    ];

    return (
      <div className="grid min-w-[12rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
        <div className="font-medium">
          {point.year} (age {point.age})
        </div>
        <div className="flex w-full items-center gap-2">
          <div className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: 'var(--chart-1)' }} />
          <div className="flex flex-1 items-center justify-between gap-2 leading-none">
            <span className="text-muted-foreground">Total Net Worth</span>
            <span className="font-mono font-semibold tabular-nums text-foreground">{formatCompactCurrency(point.totalNetWorth, money.currency)}</span>
          </div>
        </div>
        <div className="grid gap-1 border-t border-border/50 pt-1.5">
          {breakdownRows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-2 leading-none">
              <span className="text-muted-foreground">{r.label}</span>
              <span className="font-mono tabular-nums text-foreground">{formatCompactCurrency(r.value, money.currency)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
      <AreaChart data={data} margin={{ left: 4, right: 4, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
        <CompatXAxis dataKey="year" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
        <CompatYAxis tickLine={false} axisLine={false} tickMargin={8} width={isMobile ? 40 : 64} tickFormatter={(v: number) => formatCompactCurrency(v, money.currency)} />
        <ChartTooltip content={renderTooltip} />
        <CompatArea type="monotone" dataKey="totalNetWorth" stroke="var(--chart-1)" strokeWidth={2} fill="url(#netWorthFill)" />
      </AreaChart>
    </ChartContainer>
  );
}
