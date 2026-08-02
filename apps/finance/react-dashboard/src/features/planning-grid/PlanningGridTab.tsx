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
import { RetirementYearStepper } from './RetirementYearStepper';
import type { LedgerYearRow } from '../../engine/types';

export function PlanningGridTab() {
  const { data: scenarios = [] } = useScenarios();
  const { activeScenarioId } = useActiveScenario();
  const activeScenario = scenarios.find((s) => s.id === activeScenarioId) ?? null;

  const { data: overrides = [] } = useGridOverrides(activeScenario?.id);
  const saveScenario = useSaveScenario();
  const saveOverride = useSaveOverride(activeScenario?.id);
  const deleteOverride = useDeleteOverride(activeScenario?.id);

  const { rows, warnings, error } = useLedger(activeScenario, overrides);

  const [auditRow, setAuditRow] = useState<LedgerYearRow | null>(null);
  const [overrideYear, setOverrideYear] = useState<number | null>(null);

  if (!activeScenario) {
    return <DashCard>Create a scenario in Scenario Setup to see the planning grid.</DashCard>;
  }

  const existingOverride = overrideYear !== null ? overrides.find((o) => o.year === overrideYear && o.field === 'spendingNominal') : undefined;
  const plannedRow = overrideYear !== null ? rows.find((r) => r.year === overrideYear) : undefined;

  // Narrowed to non-null here (see the guard above) - captured in a local so
  // the nested function below doesn't lose that narrowing across the closure boundary.
  const scenario = activeScenario;

  function updatePersonRetirementYear(personId: string, year: number | null) {
    const persons = scenario.household.persons.map((p) => (p.id === personId ? { ...p, retirementStartYear: year } : p));
    saveScenario.mutate({ ...scenario, household: { persons }, updatedAt: new Date().toISOString() });
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <DashCard className="border-loss/30 bg-loss-bg flex items-start gap-2.5 py-3">
          <AlertTriangle className="size-4 text-loss shrink-0 mt-0.5" />
          <div className="text-[12.5px] text-loss-dark w-full">
            <p className="font-semibold mb-1">This scenario failed to calculate.</p>
            <p className="mb-1.5">Something in the scenario's data is causing the engine to throw - check for a waterfall step or override pointing at a removed account.</p>
            <details>
              <summary className="cursor-pointer font-medium">Show details</summary>
              <pre className="mt-1.5 whitespace-pre-wrap break-words text-[11.5px] bg-surface border border-loss/20 rounded-md p-2">
                {error.message}
                {error.stack ? `\n\n${error.stack}` : ''}
              </pre>
            </details>
          </div>
        </DashCard>
      )}

      {!error && warnings.length > 0 && (
        <DashCard className="border-loss/30 bg-loss-bg flex items-start gap-2.5 py-3">
          <AlertTriangle className="size-4 text-loss shrink-0 mt-0.5" />
          <div className="text-[12.5px] text-loss-dark w-full">
            <p className="font-semibold mb-1">
              {warnings.length} shortfall{warnings.length > 1 ? 's' : ''} in this plan
            </p>
            <p>{warnings[0].message}</p>
            {warnings.length > 1 && (
              <details className="mt-1">
                <summary className="cursor-pointer font-medium">Show all {warnings.length} warnings</summary>
                <ul className="mt-1.5 list-disc pl-4 space-y-0.5">
                  {warnings.map((w, i) => (
                    <li key={i}>
                      {w.year}: {w.message}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </DashCard>
      )}

      {!error && (
        <>
          <p className="text-[12.5px] text-dim">
            Click a row to see its formula breakdown. Click a "Nominal" spending value to override it for that year.
          </p>

          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {activeScenario.household.persons.map((person) => (
              <RetirementYearStepper
                key={person.id}
                label={person.label}
                value={person.retirementStartYear}
                birthYear={person.birthYear}
                onChange={(year) => updatePersonRetirementYear(person.id, year)}
              />
            ))}
          </div>

          <LedgerTable scenario={activeScenario} rows={rows} overrides={overrides} onOpenAudit={setAuditRow} onEditOverride={(row) => setOverrideYear(row.year)} />
        </>
      )}

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
