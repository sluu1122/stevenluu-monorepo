import { DashCard } from '../../components/DashCard';
import { useActiveScenario } from '../../hooks/useActiveScenario';
import { useScenarios } from '../../hooks/useScenarios';
import { useGridOverrides } from '../../hooks/useGridOverrides';
import { usePersonView } from '../../hooks/useLedger';
import { useMoney } from '../../hooks/useDisplayCurrency';
import { PersonViewSelector } from '../../components/PersonViewSelector';
import { DisplayCurrencyToggle } from '../../components/DisplayCurrencyToggle';
import { NetWorthOverTimeChart } from './NetWorthOverTimeChart';
import { BalanceByBucketStackedChart } from './BalanceByBucketStackedChart';
import { ScenarioComparisonToggle } from './ScenarioComparisonToggle';

export function ChartsAnalyticsTab() {
  const { data: scenarios = [] } = useScenarios();
  const { activeScenarioId } = useActiveScenario();
  const activeScenario = scenarios.find((s) => s.id === activeScenarioId) ?? null;

  const { data: overrides = [] } = useGridOverrides(activeScenario?.id);
  const { rows, person, buckets, bucketOwnerLabels, combined, label } = usePersonView(activeScenario, overrides);
  const money = useMoney(activeScenario);

  if (!activeScenario) {
    return <DashCard>Create a scenario in Scenario Setup to see charts.</DashCard>;
  }

  const suffix = activeScenario.persons.length > 1 ? ` - ${label}` : '';

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <PersonViewSelector persons={activeScenario.persons} selectedPerson={person} />
        <DisplayCurrencyToggle scenarioCurrency={activeScenario.currency} />
      </div>

      <DashCard>
        <h3 className="text-[15px] font-semibold text-ink mb-4">Net Worth Over Time{suffix}</h3>
        <NetWorthOverTimeChart rows={rows} buckets={buckets} money={money} />
      </DashCard>
      <DashCard>
        <h3 className="text-[15px] font-semibold text-ink mb-4">Balance by Account Bucket{suffix}</h3>
        <BalanceByBucketStackedChart rows={rows} buckets={buckets} money={money} bucketOwnerLabels={combined ? bucketOwnerLabels : undefined} />
      </DashCard>

      <ScenarioComparisonToggle
        activeScenario={activeScenario}
        otherScenarios={scenarios.filter((s) => s.id !== activeScenario.id && s.currency === activeScenario.currency)}
      />
    </div>
  );
}
