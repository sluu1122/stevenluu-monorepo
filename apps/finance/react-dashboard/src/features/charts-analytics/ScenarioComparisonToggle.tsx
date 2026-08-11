import { useState } from 'react';
import { LineChart, CartesianGrid } from 'recharts';
import { Checkbox } from '@repo/ui/components/checkbox';
import { DashCard } from '../../components/DashCard';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@repo/ui/components/chart';
import { CompatLine, CompatXAxis, CompatYAxis } from '@repo/ui/lib/rechartsCompat';
import { buildScenarioLedger } from '../../engine/ledger';
import { combineLedgers } from '../../engine/combineLedgers';
import { getPrimaryPerson } from '../../engine/household';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { formatCompactCurrency } from '../../lib/format';
import { useMoney } from '../../hooks/useDisplayCurrency';
import type { Scenario } from '../../engine/schema';

// Same fixed categorical order used by BalanceByBucketStackedChart - here it
// identifies scenarios (active first) rather than account buckets.
const PALETTE = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)'];
const MAX_COMPARISONS = 2;

interface ScenarioComparisonToggleProps {
  activeScenario: Scenario;
  otherScenarios: Scenario[];
}

export function ScenarioComparisonToggle({ activeScenario, otherScenarios }: ScenarioComparisonToggleProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const money = useMoney(activeScenario);
  const isMobile = useIsMobile();

  if (otherScenarios.length === 0) return null;

  function toggle(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_COMPARISONS) return prev;
      return [...prev, id];
    });
  }

  const comparisonScenarios = otherScenarios.filter((s) => selectedIds.includes(s.id));
  // Comparison overlays ignore each scenario's own grid overrides for
  // simplicity - this chart is about comparing baseline assumptions, not
  // one-off lump-sum edits. Each scenario is compared on its whole-household
  // net worth (every person combined), not one person's slice of it.
  const series = [activeScenario, ...comparisonScenarios].map((scenario, i) => ({
    id: scenario.id,
    label: scenario.name,
    color: PALETTE[i % PALETTE.length],
    rows: combineLedgers(buildScenarioLedger(scenario, []), getPrimaryPerson(scenario.persons).id, scenario.sharedAccountBuckets).rows,
  }));

  const yearSet = new Set<number>();
  series.forEach((s) => s.rows.forEach((row) => yearSet.add(row.year)));
  const years = [...yearSet].sort((a, b) => a - b);
  // Age is shown relative to the active scenario (series[0]) - comparison
  // scenarios may have different birth years, so there's no single "age" a
  // given calendar year maps to across all of them.
  const activeSeries = series[0];
  const data = years.map((year) => {
    const point: Record<string, number | undefined> = { year, age: activeSeries.rows.find((row) => row.year === year)?.age };
    for (const s of series) {
      const found = s.rows.find((row) => row.year === year)?.totalNetWorth;
      point[s.id] = found === undefined ? undefined : money.convert(found);
    }
    return point;
  });

  const config: ChartConfig = {};
  series.forEach((s) => {
    config[s.id] = { label: s.label, color: s.color };
  });

  // The color swatch is only rendered by the shared ChartTooltipContent when
  // no custom `formatter` is passed, so it has to be drawn manually here to
  // keep one - same pattern as BalanceByBucketStackedChart.
  function renderTooltip(props: React.ComponentProps<typeof ChartTooltipContent>) {
    return (
      <ChartTooltipContent
        {...props}
        labelFormatter={(_value: unknown, payload?: { payload?: unknown }[]) => {
          const point = payload?.[0]?.payload as { year: number; age?: number } | undefined;
          return point ? (point.age !== undefined ? `${point.year} (age ${point.age})` : `${point.year}`) : '';
        }}
        formatter={(value: unknown, name: unknown) => {
          const seriesId = String(name);
          const label = config[seriesId]?.label;
          const color = config[seriesId]?.color;
          return (
            <>
              <div className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />
              <div className="flex flex-1 items-center justify-between gap-2 leading-none">
                <span className="text-muted-foreground">{label ?? seriesId}</span>
                <span className="font-mono font-medium tabular-nums text-foreground">{formatCompactCurrency(Number(value), money.currency)}</span>
              </div>
            </>
          );
        }}
      />
    );
  }

  return (
    <DashCard>
      <h3 className="text-[15px] font-semibold text-ink mb-1">Compare Scenarios</h3>
      <p className="text-[12.5px] text-dim mb-4">
        Overlay up to {MAX_COMPARISONS} other {activeScenario.currency} scenarios' net worth against "{activeScenario.name}".
      </p>
      <div className="flex flex-wrap gap-4 mb-4">
        {otherScenarios.map((scenario) => (
          <label key={scenario.id} className="flex items-center gap-2 text-[13px] text-ink cursor-pointer">
            <Checkbox
              checked={selectedIds.includes(scenario.id)}
              onCheckedChange={() => toggle(scenario.id)}
              disabled={!selectedIds.includes(scenario.id) && selectedIds.length >= MAX_COMPARISONS}
            />
            {scenario.name}
          </label>
        ))}
      </div>

      {selectedIds.length > 0 && (
        <ChartContainer config={config} className="aspect-auto h-[300px] w-full">
          <LineChart data={data} margin={{ left: 4, right: 4, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
            <CompatXAxis dataKey="year" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
            <CompatYAxis tickLine={false} axisLine={false} tickMargin={8} width={isMobile ? 40 : 64} tickFormatter={(v: number) => formatCompactCurrency(v, money.currency)} />
            <ChartTooltip content={renderTooltip} />
            <ChartLegend content={<ChartLegendContent />} />
            {series.map((s) => (
              <CompatLine key={s.id} type="monotone" dataKey={s.id} stroke={s.color} strokeWidth={2} dot={false} connectNulls />
            ))}
          </LineChart>
        </ChartContainer>
      )}
    </DashCard>
  );
}
