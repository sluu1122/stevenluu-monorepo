import { useState } from 'react';
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Checkbox } from '@repo/ui/components/checkbox';
import { DashCard } from '../../components/DashCard';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@repo/ui/components/chart';
import { buildLedger } from '../../engine/ledger';
import { formatCompactCurrency } from '../../lib/format';
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
  // one-off lump-sum edits.
  const series = [activeScenario, ...comparisonScenarios].map((scenario, i) => ({
    id: scenario.id,
    label: scenario.name,
    color: PALETTE[i % PALETTE.length],
    rows: buildLedger(scenario, []).rows,
  }));

  const yearSet = new Set<number>();
  series.forEach((s) => s.rows.forEach((row) => yearSet.add(row.year)));
  const years = [...yearSet].sort((a, b) => a - b);
  const data = years.map((year) => {
    const point: Record<string, number | undefined> = { year };
    for (const s of series) {
      point[s.id] = s.rows.find((row) => row.year === year)?.totalNetWorth;
    }
    return point;
  });

  const config: ChartConfig = {};
  series.forEach((s) => {
    config[s.id] = { label: s.label, color: s.color };
  });

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
            <XAxis dataKey="year" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} width={64} tickFormatter={(v) => formatCompactCurrency(v, activeScenario.currency)} />
            {/* @ts-expect-error - see NetWorthOverTimeChart: recharts@3.9.2's own Tooltip content prop typing has an unrelated `& string` intersection. */}
            <ChartTooltip content={(props) => <ChartTooltipContent {...props} formatter={(value) => formatCompactCurrency(Number(value), activeScenario.currency)} />} />
            <ChartLegend content={<ChartLegendContent />} />
            {series.map((s) => (
              <Line key={s.id} type="monotone" dataKey={s.id} stroke={s.color} strokeWidth={2} dot={false} connectNulls />
            ))}
          </LineChart>
        </ChartContainer>
      )}
    </DashCard>
  );
}
