import { AreaChart, CartesianGrid } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@repo/ui/components/chart';
import { CompatArea, CompatXAxis, CompatYAxis } from '@repo/ui/lib/rechartsCompat';
import { formatCompactCurrency } from '../../lib/format';
import type { MoneyFormatter } from '../../hooks/useDisplayCurrency';
import type { AccountBucket } from '../../engine/schema';
import type { LedgerYearRow } from '../../engine/types';

// Fixed categorical order (dataviz skill's validated 8-hue palette) - assigned
// by bucket position, never cycled or re-derived from a filtered set.
const PALETTE = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
];
const OTHER_SERIES_ID = '__other__';
const OTHER_COLOR = 'var(--color-slate)';

interface BalanceByBucketStackedChartProps {
  rows: LedgerYearRow[];
  buckets: AccountBucket[];
  money: MoneyFormatter;
  /** Set in the combined view, where two people can own identically-named accounts. */
  bucketOwnerLabels?: Record<string, string>;
}

export function BalanceByBucketStackedChart({ rows, buckets, money, bucketOwnerLabels }: BalanceByBucketStackedChartProps) {
  function seriesLabel(bucket: AccountBucket) {
    const owner = bucketOwnerLabels?.[bucket.id];
    return owner ? `${owner} · ${bucket.label}` : bucket.label;
  }

  // The palette has exactly eight validated hues. Rather than cycling it (which
  // would give two different accounts the same colour), anything past the
  // eighth stacks into a single neutral "Other accounts" band.
  const plottedBuckets = buckets.slice(0, PALETTE.length);
  const overflowBuckets = buckets.slice(PALETTE.length);

  const config: ChartConfig = {};
  plottedBuckets.forEach((bucket, i) => {
    config[bucket.id] = { label: seriesLabel(bucket), color: PALETTE[i] };
  });
  if (overflowBuckets.length > 0) {
    config[OTHER_SERIES_ID] = { label: `Other accounts (${overflowBuckets.length})`, color: OTHER_COLOR };
  }

  const data = rows.map((row) => {
    const point: Record<string, number> = { year: row.year, age: row.age };
    for (const bucket of plottedBuckets) point[bucket.id] = money.convert(row.accountEnd[bucket.id] ?? 0);
    if (overflowBuckets.length > 0) {
      point[OTHER_SERIES_ID] = money.convert(overflowBuckets.reduce((sum, bucket) => sum + (row.accountEnd[bucket.id] ?? 0), 0));
    }
    return point;
  });

  const series = [
    ...plottedBuckets.map((bucket, i) => ({ id: bucket.id, color: PALETTE[i] })),
    ...(overflowBuckets.length > 0 ? [{ id: OTHER_SERIES_ID, color: OTHER_COLOR }] : []),
  ];

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
        labelFormatter={(_value: unknown, payload?: { payload?: unknown }[]) => {
          const point = payload?.[0]?.payload as { year: number; age: number } | undefined;
          return point ? `${point.year} (age ${point.age})` : '';
        }}
        formatter={(value: unknown, name: unknown) => {
          const bucketId = String(name);
          const color = config[bucketId]?.color;
          return (
            <>
              <div className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />
              <div className="flex flex-1 items-center justify-between gap-2 leading-none">
                <span className="text-muted-foreground">{config[bucketId]?.label ?? bucketId}</span>
                <span className="font-mono font-medium tabular-nums text-foreground">{formatCompactCurrency(Number(value), money.currency)}</span>
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
        <CompatXAxis dataKey="year" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
        <CompatYAxis tickLine={false} axisLine={false} tickMargin={8} width={64} tickFormatter={(v: number) => formatCompactCurrency(v, money.currency)} />
        <ChartTooltip content={renderTooltip} />
        <ChartLegend content={<ChartLegendContent />} />
        {series.map((s) => (
          <CompatArea key={s.id} type="monotone" dataKey={s.id} stackId="1" stroke={s.color} fill={s.color} fillOpacity={0.55} />
        ))}
      </AreaChart>
    </ChartContainer>
  );
}
