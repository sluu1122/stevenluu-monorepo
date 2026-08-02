import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { DashCard } from '../../components/DashCard';
import { useActiveScenario } from '../../hooks/useActiveScenario';
import { useScenarios, useSaveScenario } from '../../hooks/useScenarios';
import { useGridOverrides, useSaveOverride, useDeleteOverride } from '../../hooks/useGridOverrides';
import { useLedger } from '../../hooks/useLedger';
import { generateId } from '../../engine/id';
import { LedgerTable } from './LedgerTable';
import { FormulaBreakdownSheet } from './FormulaBreakdownSheet';
import { OverrideEditDialog } from './OverrideEditDialog';
import type { LedgerYearRow } from '../../engine/types';

export function PlanningGridTab() {
  const { data: scenarios = [] } = useScenarios();
  const { activeScenarioId } = useActiveScenario();
  const activeScenario = scenarios.find((s) => s.id === activeScenarioId) ?? null;

  const { data: overrides = [] } = useGridOverrides(activeScenario?.id);
  const saveScenario = useSaveScenario();
  const saveOverride = useSaveOverride(activeScenario?.id);
  const deleteOverride = useDeleteOverride(activeScenario?.id);

  const { rows, warnings } = useLedger(activeScenario, overrides);

  const [auditRow, setAuditRow] = useState<LedgerYearRow | null>(null);
  const [overrideYear, setOverrideYear] = useState<number | null>(null);

  if (!activeScenario) {
    return <DashCard>Create a scenario in Scenario Setup to see the planning grid.</DashCard>;
  }

  const existingOverride = overrideYear !== null ? overrides.find((o) => o.year === overrideYear && o.field === 'spendingNominal') : undefined;
  const plannedRow = overrideYear !== null ? rows.find((r) => r.year === overrideYear) : undefined;

  return (
    <div className="flex flex-col gap-4">
      {warnings.length > 0 && (
        <DashCard className="border-loss/30 bg-loss-bg flex items-start gap-2.5 py-3">
          <AlertTriangle className="size-4 text-loss shrink-0 mt-0.5" />
          <div className="text-[12.5px] text-loss-dark">
            <p className="font-semibold mb-1">
              {warnings.length} shortfall{warnings.length > 1 ? 's' : ''} in this plan
            </p>
            <p>{warnings[0].message}</p>
          </div>
        </DashCard>
      )}

      <p className="text-[12.5px] text-dim">
        Click a row to see its formula breakdown. Click a "Nominal" spending value to override it for that year. Pick "Retire" on the row you want to start decumulation.
      </p>

      <LedgerTable
        scenario={activeScenario}
        rows={rows}
        overrides={overrides}
        onSelectRetirementYear={(year) => saveScenario.mutate({ ...activeScenario, retirementStartYear: year, updatedAt: new Date().toISOString() })}
        onOpenAudit={setAuditRow}
        onEditOverride={(row) => setOverrideYear(row.year)}
      />

      <FormulaBreakdownSheet row={auditRow} currency={activeScenario.currency} onClose={() => setAuditRow(null)} />

      <OverrideEditDialog
        key={overrideYear}
        year={overrideYear}
        plannedValue={plannedRow?.spendingNominal ?? 0}
        existingOverride={existingOverride}
        onClose={() => setOverrideYear(null)}
        onSave={(value, note) => {
          if (overrideYear === null) return;
          saveOverride.mutate({
            id: existingOverride?.id ?? generateId('override'),
            scenarioId: activeScenario.id,
            year: overrideYear,
            field: 'spendingNominal',
            value,
            note: note || undefined,
            createdAt: existingOverride?.createdAt ?? new Date().toISOString(),
          });
          setOverrideYear(null);
        }}
        onClear={() => {
          if (existingOverride) deleteOverride.mutate(existingOverride.id);
          setOverrideYear(null);
        }}
      />
    </div>
  );
}
