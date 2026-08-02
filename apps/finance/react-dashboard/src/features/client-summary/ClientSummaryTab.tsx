import { Printer } from 'lucide-react';
import { DashCard } from '../../components/DashCard';
import { Button } from '@repo/ui/components/button';
import { useActiveScenario } from '../../hooks/useActiveScenario';
import { useScenarios } from '../../hooks/useScenarios';
import { useGridOverrides } from '../../hooks/useGridOverrides';
import { useLedger } from '../../hooks/useLedger';
import { SummaryKeyMetrics } from './SummaryKeyMetrics';
import { SummaryPrintableTable } from './SummaryPrintableTable';

export function ClientSummaryTab() {
  const { data: scenarios = [] } = useScenarios();
  const { activeScenarioId } = useActiveScenario();
  const activeScenario = scenarios.find((s) => s.id === activeScenarioId) ?? null;

  const { data: overrides = [] } = useGridOverrides(activeScenario?.id);
  const { rows, warnings } = useLedger(activeScenario, overrides);

  if (!activeScenario) {
    return <DashCard>Create a scenario in Scenario Setup to see the client summary.</DashCard>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-[17px] font-semibold text-ink">{activeScenario.name}</h2>
          <p className="text-[12.5px] text-dim">
            Tax residency: {activeScenario.country === 'US' ? 'United States' : 'Canada'} · {activeScenario.currency}
          </p>
        </div>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="size-4" /> Print
        </Button>
      </div>

      <div className="hidden print:block">
        <h2 className="text-[18px] font-semibold text-ink mb-1">{activeScenario.name} - Retirement Plan Summary</h2>
        <p className="text-[12.5px] text-dim mb-4">
          Tax residency: {activeScenario.country === 'US' ? 'United States' : 'Canada'} · {activeScenario.currency} · Generated {new Date().toLocaleDateString()}
        </p>
      </div>

      <SummaryKeyMetrics rows={rows} currency={activeScenario.currency} retirementStartYear={activeScenario.retirementStartYear} hasShortfall={warnings.length > 0} />

      {warnings.length > 0 && (
        <DashCard className="border-loss/30 bg-loss-bg py-3">
          <p className="text-[12.5px] text-loss-dark">
            This plan has {warnings.length} projected shortfall{warnings.length > 1 ? 's' : ''} - see the Planning Grid for details.
          </p>
        </DashCard>
      )}

      <SummaryPrintableTable rows={rows} currency={activeScenario.currency} />
    </div>
  );
}
