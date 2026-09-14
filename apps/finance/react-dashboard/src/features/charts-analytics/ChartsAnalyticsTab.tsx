import { useState } from 'react';
import { DashCard } from '../../components/DashCard';
import { ScenarioErrorBanner } from '../../components/ScenarioErrorBanner';
import { EmptyScenarioState } from '../../components/EmptyScenarioState';
import { useActiveScenario } from '../../hooks/useActiveScenario';
import { useScenarios } from '../../hooks/useScenarios';
import { useGridOverrides } from '../../hooks/useGridOverrides';
import { usePersonView } from '../../hooks/useLedger';
import { useMoney } from '../../hooks/useDisplayCurrency';
import { PersonViewSelector } from '../../components/PersonViewSelector';
import { DisplayCurrencyToggle } from '../../components/DisplayCurrencyToggle';
import { ValueBasisToggle, type ValueBasis } from '../../components/ValueBasisToggle';
import { NOMINAL, buildDeflate } from '../../lib/realTerms';
import { NetWorthOverTimeChart } from './NetWorthOverTimeChart';
import { BalanceByBucketStackedChart } from './BalanceByBucketStackedChart';
import { ScenarioComparisonToggle } from './ScenarioComparisonToggle';
import { describeAssumptions } from '../../lib/assumptionsSummary';

export function ChartsAnalyticsTab() {
  const { data: scenarios = [] } = useScenarios();
  const { activeScenarioId } = useActiveScenario();
  const activeScenario = scenarios.find((s) => s.id === activeScenarioId) ?? null;

  const { data: overrides = [] } = useGridOverrides(activeScenario?.id);
  const { rows, error, person, buckets, bucketOwnerLabels, combined, label } = usePersonView(activeScenario, overrides);
  const money = useMoney(activeScenario);
  const [basis, setBasis] = useState<ValueBasis>('nominal');

  if (!activeScenario) {
    return <EmptyScenarioState what="charts" />;
  }

  // Nothing below this point is worth drawing on a failed calculation: `rows`
  // is empty, so every chart renders as blank axes that read like a plan with
  // no money in it rather than like an error.
  if (error) {
    return <ScenarioErrorBanner error={error} />;
  }

  const suffix = activeScenario.persons.length > 1 ? ` - ${label}` : '';
  // Built once from the projected years these charts actually plot.
  const deflate = basis === 'real' ? buildDeflate(activeScenario.inflation, rows.map((row) => row.year)) : NOMINAL;
  const basisNote = basis === 'real' ? " (today's $)" : '';

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <PersonViewSelector persons={activeScenario.persons} selectedPerson={person} />
          {/* Under the charts' own controls: a curve ending at four million
              means something different at 7% than at 4%, and the rates live a
              tab away where nobody is looking while reading the output. */}
          <p className="text-[12px] text-dim mt-1.5">{describeAssumptions(activeScenario)}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ValueBasisToggle value={basis} onChange={setBasis} />
          <DisplayCurrencyToggle scenarioCurrency={activeScenario.currency} />
        </div>
      </div>

      <DashCard>
        <h3 className="text-[15px] font-semibold text-ink mb-4">
          Net Worth Over Time{suffix}
          {basisNote && <span className="font-normal text-dim">{basisNote}</span>}
        </h3>
        <NetWorthOverTimeChart rows={rows} buckets={buckets} money={money} deflate={deflate} />
      </DashCard>
      <DashCard>
        <h3 className="text-[15px] font-semibold text-ink mb-4">
          Balance by Account{suffix}
          {basisNote && <span className="font-normal text-dim">{basisNote}</span>}
        </h3>
        <BalanceByBucketStackedChart rows={rows} buckets={buckets} money={money} bucketOwnerLabels={combined ? bucketOwnerLabels : undefined} deflate={deflate} />
      </DashCard>

      <ScenarioComparisonToggle
        activeScenario={activeScenario}
        otherScenarios={scenarios.filter((s) => s.id !== activeScenario.id && s.currency === activeScenario.currency)}
        realTerms={basis === 'real'}
      />
    </div>
  );
}
