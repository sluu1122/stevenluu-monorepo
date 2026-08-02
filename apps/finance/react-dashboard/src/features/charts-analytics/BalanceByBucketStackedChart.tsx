import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@repo/ui/components/chart';
import { formatCompactCurrency } from '../../lib/format';
import type { AccountBucket, Currency } from '../../engine/schema';
import type { LedgerYearRow } from '../../engine/types';

// Fixed categorical order (dataviz skill's validated 8-hue palette, slots 1-4) -
// assigned by bucket position, never cycled or re-derived from a filtered set.
const PALETTE = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)'];

interface BalanceByBucketStackedChartProps {
  rows: LedgerYearRow[];
  buckets: AccountBucket[];
  currency: Currency;
}

export function BalanceByBucketStackedChart({ rows, buckets, currency }: BalanceByBucketStackedChartProps) {
  const config: ChartConfig = {};
  buckets.forEach((bucket, i) => {
    config[bucket.id] = { label: bucket.label, color: PALETTE[i % PALETTE.length] };
  });

  const data = rows.map((row) => {
    const point: Record<string, number> = { year: row.year, age: row.age };
    for (const bucket of buckets) point[bucket.id] = row.accountEnd[bucket.id] ?? 0;
    return point;
  });

  // The shared ChartTooltipContent resolves its header from the hovered
  // series' config label whenever Recharts' own `label` isn't a string (true
  // here - it's the numeric year), so read year/age straight off the raw
  // data point instead of trusting the (wrongly-resolved) `value` this gets.
  // The color swatch is also only rendered when no custom `formatter` is
  // passed, so a custom formatter has to draw its own swatch to keep one.
  function renderTooltip(props: React.ComponentProps<typeof ChartTooltipContent>) {
    return (
      <ChartTooltipContent
        {...props}
        labelFormatter={(_value, payload) => {
          const point = payload?.[0]?.payload as { year: number; age: number } | undefined;
          return point ? `${point.year} (age ${point.age})` : '';
        }}
        formatter={(value, name) => {
          const bucketId = String(name);
          const bucket = buckets.find((b) => b.id === bucketId);
          const color = config[bucketId]?.color;
          return (
            <>
              <div className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />
              <div className="flex flex-1 items-center justify-between gap-2 leading-none">
                <span className="text-muted-foreground">{bucket?.label ?? bucketId}</span>
                <span className="font-mono font-medium tabular-nums text-foreground">{formatCompactCurrency(Number(value), currency)}</span>
              </div>
            </>
          );
        }}
      />
    );
  }

  return (
    <ChartContainer config={config} className="aspect-auto h-[320px] w-full">
      <AreaChart data={data} margin={{ left: 4, right: 4, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="year" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} width={64} tickFormatter={(v) => formatCompactCurrency(v, currency)} />
        {/* @ts-expect-error - recharts@3.9.2's own Tooltip prop types intersect `content` with `string` for reasons unrelated to this (well-documented, standard) function-as-content usage. */}
        <ChartTooltip content={renderTooltip} />
        <ChartLegend content={<ChartLegendContent />} />
        {buckets.map((bucket, i) => (
          <Area key={bucket.id} type="monotone" dataKey={bucket.id} stackId="1" stroke={PALETTE[i % PALETTE.length]} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.55} />
        ))}
      </AreaChart>
    </ChartContainer>
  );
}
