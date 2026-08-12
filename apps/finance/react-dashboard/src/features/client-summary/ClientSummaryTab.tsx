import { FileText, Printer } from 'lucide-react';
import { DashCard } from '../../components/DashCard';
import { Button } from '@repo/ui/components/button';
import { useActiveScenario } from '../../hooks/useActiveScenario';
import { useScenarios } from '../../hooks/useScenarios';
import { useGridOverrides } from '../../hooks/useGridOverrides';
import { usePersonView } from '../../hooks/useLedger';
import { useMoney } from '../../hooks/useDisplayCurrency';
import { PersonViewSelector } from '../../components/PersonViewSelector';
import { DisplayCurrencyToggle } from '../../components/DisplayCurrencyToggle';
import { SummaryKeyMetrics } from './SummaryKeyMetrics';
import { SummaryPrintableTable } from './SummaryPrintableTable';
import { partitionWarnings } from '../../lib/warnings';
import { exportPlainTextSummary } from './exportPlainTextSummary';

export function ClientSummaryTab() {
  const { data: scenarios = [] } = useScenarios();
  const { activeScenarioId } = useActiveScenario();
  const activeScenario = scenarios.find((s) => s.id === activeScenarioId) ?? null;

  const { data: overrides = [] } = useGridOverrides(activeScenario?.id);
  const { rows, warnings, person, buckets, combined, label } = usePersonView(activeScenario, overrides);
  const { shortfalls, contributions } = partitionWarnings(warnings);
  const money = useMoney(activeScenario);

  if (!activeScenario) {
    return <DashCard>Create a scenario in Scenario Setup to see the client summary.</DashCard>;
  }

  const showsMultiplePersons = activeScenario.persons.length > 1;
  // In the combined view every person retires on their own schedule, so
  // there's no single household retirement year to headline - the selected
  // person's is the one the rows' age/year axis already follows.
  const retirementStartYear = person?.retirementStartYear ?? null;

  return (
    <div className="flex flex-col gap-5">
      <PersonViewSelector persons={activeScenario.persons} selectedPerson={person} />

      <div className="flex items-center justify-between gap-3 flex-wrap print:hidden">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold text-ink">
            {activeScenario.name}
            {showsMultiplePersons ? ` - ${label}` : ''}
          </h2>
          <p className="text-[12.5px] text-dim">
            Tax residency: {activeScenario.country === 'US' ? 'United States' : 'Canada'} · {money.currency}
            {money.isConverted && ` (converted from ${activeScenario.currency} at ${activeScenario.exchangeRateUsdToCad})`}
          </p>
          <p className="text-[11px] text-dim mt-0.5">Demo only — figures may be inaccurate. Not financial advice.</p>
        </div>
        <div className="flex items-center gap-2">
          <DisplayCurrencyToggle scenarioCurrency={activeScenario.currency} />
          <Button
            variant="outline"
            className="cursor-pointer"
            onClick={() => exportPlainTextSummary(activeScenario, rows, { buckets, viewLabel: label, retirementStartYear, combined, money })}
          >
            <FileText className="size-4" /> Export
          </Button>
          <Button variant="outline" className="cursor-pointer" onClick={() => window.print()}>
            <Printer className="size-4" /> Print
          </Button>
        </div>
      </div>

      <div className="hidden print:block">
        <h2 className="text-[18px] font-semibold text-ink mb-1">
          {activeScenario.name}
          {showsMultiplePersons ? ` - ${label}` : ''} - Retirement Plan Summary
        </h2>
        <p className="text-[12.5px] text-dim mb-1">
          Tax residency: {activeScenario.country === 'US' ? 'United States' : 'Canada'} · {money.currency}
          {money.isConverted && ` (converted from ${activeScenario.currency} at ${activeScenario.exchangeRateUsdToCad})`} · Generated{' '}
          {new Date().toLocaleDateString()}
        </p>
        <p className="text-[11px] text-dim mb-4">Demo only — figures may be inaccurate. Not financial advice.</p>
      </div>

      {/* Only real shortfalls flip the key-metric badge. A contribution that
          couldn't be routed says nothing about whether the plan holds up, and
          flagging it here marked healthy plans as failing. */}
      <SummaryKeyMetrics rows={rows} money={money} retirementStartYear={retirementStartYear} hasShortfall={shortfalls.length > 0} />

      {shortfalls.length > 0 && (
        <DashCard className="border-loss/30 bg-loss-bg py-3">
          <p className="text-[12.5px] text-loss-dark">
            This plan has {shortfalls.length} projected shortfall{shortfalls.length > 1 ? 's' : ''} - see the Planning Grid for details.
          </p>
        </DashCard>
      )}

      {contributions.length > 0 && (
        <DashCard className="border-indigo/25 bg-indigo-bg py-3">
          <p className="text-[12.5px] text-ink">
            Some scheduled contributions couldn't be funded - see the Planning Grid for details. This doesn't reduce the projected balances above.
          </p>
        </DashCard>
      )}

      <SummaryPrintableTable rows={rows} money={money} />
    </div>
  );
}
