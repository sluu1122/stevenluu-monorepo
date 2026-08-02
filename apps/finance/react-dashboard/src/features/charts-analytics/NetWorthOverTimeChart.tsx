import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@repo/ui/components/chart';
import { formatCompactCurrency } from '../../lib/format';
import type { LedgerYearRow } from '../../engine/types';
import type { Currency } from '../../engine/schema';

interface NetWorthOverTimeChartProps {
  rows: LedgerYearRow[];
  currency: Currency;
}

// Single series - the chart title names it, so no legend per the dataviz skill's rule.
const chartConfig: ChartConfig = {
  totalNetWorth: { label: 'Total Net Worth', color: 'var(--chart-1)' },
};

export function NetWorthOverTimeChart({ rows, currency }: NetWorthOverTimeChartProps) {
  const data = rows.map((row) => ({ year: row.year, totalNetWorth: row.totalNetWorth }));

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
        <XAxis dataKey="year" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} width={64} tickFormatter={(v) => formatCompactCurrency(v, currency)} />
        {/* @ts-expect-error - recharts@3.9.2's own Tooltip prop types intersect `content` with `string` for reasons unrelated to this (well-documented, standard) function-as-content usage. */}
        <ChartTooltip content={(props) => <ChartTooltipContent {...props} formatter={(value) => formatCompactCurrency(Number(value), currency)} />} />
        <Area type="monotone" dataKey="totalNetWorth" stroke="var(--chart-1)" strokeWidth={2} fill="url(#netWorthFill)" />
      </AreaChart>
    </ChartContainer>
  );
}
