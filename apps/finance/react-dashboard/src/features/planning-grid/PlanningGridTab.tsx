import { useState } from 'react';
import { AlertTriangle, FileText } from 'lucide-react';
import { DashCard } from '../../components/DashCard';
import { Button } from '@repo/ui/components/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@repo/ui/components/dialog';
import { useActiveScenario } from '../../hooks/useActiveScenario';
import { useScenarios, useSaveScenario } from '../../hooks/useScenarios';
import { useGridOverrides, useSaveOverride, useDeleteOverride } from '../../hooks/useGridOverrides';
import { usePersonView } from '../../hooks/useLedger';
import { useMoney } from '../../hooks/useDisplayCurrency';
import { generateId } from '../../engine/id';
import { PersonViewSelector } from '../../components/PersonViewSelector';
import { DisplayCurrencyToggle } from '../../components/DisplayCurrencyToggle';
import { LedgerTable } from './LedgerTable';
import { FormulaBreakdownPanel } from './FormulaBreakdownPanel';
import { OverrideEditDialog } from './OverrideEditDialog';
import { exportGridCsv } from './exportGridCsv';

export function PlanningGridTab() {
  const { data: scenarios = [] } = useScenarios();
  const { activeScenarioId } = useActiveScenario();
  const activeScenario = scenarios.find((s) => s.id === activeScenarioId) ?? null;

  const { data: overrides = [] } = useGridOverrides(activeScenario?.id);
  const saveScenario = useSaveScenario();
  const saveOverride = useSaveOverride(activeScenario?.id);
  const deleteOverride = useDeleteOverride(activeScenario?.id);

  const { rows, warnings, error, person, buckets, bucketOwnerLabels, sharedBucketIds, combined, label } = usePersonView(activeScenario, overrides);
  const money = useMoney(activeScenario);

  // Held as a year rather than the row object, so the panel re-reads the live
  // row whenever the ledger recomputes instead of showing a stale snapshot.
  const [auditYear, setAuditYear] = useState<number | null>(null);
  const [overrideYear, setOverrideYear] = useState<number | null>(null);
  const [warningsOpen, setWarningsOpen] = useState(false);

  if (!activeScenario) {
    return <DashCard>Create a scenario in Scenario Setup to see the planning grid.</DashCard>;
  }

  const existingOverride =
    overrideYear !== null && person ? overrides.find((o) => o.personId === person.id && o.year === overrideYear && o.field === 'spendingNominal') : undefined;
  const plannedRow = overrideYear !== null ? rows.find((r) => r.year === overrideYear) : undefined;
  const auditRow = auditYear !== null ? (rows.find((r) => r.year === auditYear) ?? null) : null;

  // Narrowed to non-null here (see the guard above) - captured in a local so
  // the nested function below doesn't lose that narrowing across the closure boundary.
  const scenario = activeScenario;

  function updatePersonRetirementYear(personId: string, year: number | null) {
    const persons = scenario.persons.map((p) => (p.id === personId ? { ...p, retirementStartYear: year } : p));
    saveScenario.mutate({ ...scenario, persons, updatedAt: new Date().toISOString() });
  }

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
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
        <DashCard className="border-loss/30 bg-loss-bg flex items-center gap-2.5 py-2 sm:py-2">
          <AlertTriangle className="size-4 text-loss shrink-0" />
          <p className="text-[12.5px] text-loss-dark truncate flex-1">
            <span className="font-semibold">
              {warnings.length} shortfall{warnings.length > 1 ? 's' : ''} in this plan
            </span>
            <span className="ml-1.5">— {warnings[0].message}</span>
          </p>
          <Button variant="ghost" size="sm" className="cursor-pointer text-loss-dark hover:text-loss-dark shrink-0" onClick={() => setWarningsOpen(true)}>
            View details
          </Button>
        </DashCard>
      )}

      <Dialog open={warningsOpen} onOpenChange={setWarningsOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {warnings.length} shortfall{warnings.length > 1 ? 's' : ''} in this plan
            </DialogTitle>
            <DialogDescription>Years where planned withdrawals exceed available account balances.</DialogDescription>
          </DialogHeader>
          <ul className="max-h-[50vh] overflow-y-auto list-disc pl-4 space-y-1 text-[13px] text-ink">
            {warnings.map((w, i) => (
              <li key={i}>
                {w.year}: {w.message}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      {!error && (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <PersonViewSelector
              persons={activeScenario.persons}
              selectedPerson={person}
              onRetirementYearChange={(year) => person && updatePersonRetirementYear(person.id, year)}
            />
            <div className="flex items-center gap-2 shrink-0">
              <DisplayCurrencyToggle scenarioCurrency={activeScenario.currency} />
              <Button
                variant="outline"
                className="cursor-pointer shrink-0"
                onClick={() =>
                  exportGridCsv(activeScenario, rows, {
                    buckets,
                    bucketOwnerLabels: combined ? bucketOwnerLabels : undefined,
                    sharedBucketIds,
                    viewLabel: label,
                    money,
                  })
                }
              >
                <FileText className="size-4" /> Export CSV
              </Button>
            </div>
          </div>

          {/* Grid and breakdown share the row: the panel sits beside the grid so
              both scroll independently, stacking below it on narrow screens. */}
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4">
            <LedgerTable
              money={money}
              buckets={buckets}
              bucketOwnerLabels={combined ? bucketOwnerLabels : undefined}
              sharedBucketIds={sharedBucketIds}
              rows={rows}
              overrides={overrides}
              personId={person?.id ?? null}
              // A combined row's spending is the sum across everyone, so there's
              // no single person whose override it would be - pick one person to edit it.
              allowOverrides={!combined}
              selectedYear={auditYear}
              // Same revision App.tsx keys its own scroll memory off: a save
              // bumps updatedAt, which is the signal that every number in the
              // grid has been recomputed and a remembered offset is stale.
              scrollMemoryKey={`${activeScenario.id}|${activeScenario.updatedAt}`}
              onOpenAudit={(row) => setAuditYear(row.year)}
              onEditOverride={(row) => setOverrideYear(row.year)}
            />
            {auditRow && (
              <FormulaBreakdownPanel
                row={auditRow}
                baseCurrency={activeScenario.currency}
                buckets={buckets}
                bucketOwnerLabels={combined ? bucketOwnerLabels : undefined}
                sharedBucketIds={sharedBucketIds}
                money={money}
                onClose={() => setAuditYear(null)}
              />
            )}
          </div>
        </>
      )}

      <OverrideEditDialog
        key={overrideYear}
        year={overrideYear}
        plannedValue={plannedRow?.spendingNominal ?? 0}
        existingOverride={existingOverride}
        onClose={() => setOverrideYear(null)}
        onSave={(value, note) => {
          if (overrideYear === null || !person) return;
          saveOverride.mutate({
            id: existingOverride?.id ?? generateId('override'),
            scenarioId: activeScenario.id,
            personId: person.id,
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
