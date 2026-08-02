import { DashCard } from '../../components/DashCard';
import { useActiveScenario } from '../../hooks/useActiveScenario';
import { useScenarios } from '../../hooks/useScenarios';
import { useGridOverrides } from '../../hooks/useGridOverrides';
import { useLedger } from '../../hooks/useLedger';
import { NetWorthOverTimeChart } from './NetWorthOverTimeChart';
import { BalanceByBucketStackedChart } from './BalanceByBucketStackedChart';
import { ScenarioComparisonToggle } from './ScenarioComparisonToggle';

export function ChartsAnalyticsTab() {
  const { data: scenarios = [] } = useScenarios();
  const { activeScenarioId } = useActiveScenario();
  const activeScenario = scenarios.find((s) => s.id === activeScenarioId) ?? null;

  const { data: overrides = [] } = useGridOverrides(activeScenario?.id);
  const { rows } = useLedger(activeScenario, overrides);

  if (!activeScenario) {
    return <DashCard>Create a scenario in Scenario Setup to see charts.</DashCard>;
  }

  return (
    <div className="flex flex-col gap-5">
      <DashCard>
        <h3 className="text-[15px] font-semibold text-ink mb-4">Net Worth Over Time</h3>
        <NetWorthOverTimeChart rows={rows} currency={activeScenario.currency} />
      </DashCard>
      <DashCard>
        <h3 className="text-[15px] font-semibold text-ink mb-4">Balance by Account Bucket</h3>
        <BalanceByBucketStackedChart rows={rows} buckets={activeScenario.accountBuckets} currency={activeScenario.currency} />
      </DashCard>

      <ScenarioComparisonToggle
        activeScenario={activeScenario}
        otherScenarios={scenarios.filter((s) => s.id !== activeScenario.id && s.currency === activeScenario.currency)}
      />
    </div>
  );
}
