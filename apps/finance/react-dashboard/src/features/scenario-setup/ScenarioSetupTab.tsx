import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form } from '@repo/ui/components/form';
import { Button } from '@repo/ui/components/button';
import { DashCard } from '../../components/DashCard';
import { useActiveScenario } from '../../hooks/useActiveScenario';
import { useScenarios, useSaveScenario } from '../../hooks/useScenarios';
import { ScenarioSchema, type Scenario } from '../../engine/schema';
import { createDefaultScenario } from '../../engine/defaults';
import { GlobalParametersForm } from './GlobalParametersForm';
import { AccountBucketsEditor } from './AccountBucketsEditor';
import { TaxAssumptionsForm } from './TaxAssumptionsForm';
import { WaterfallOrderEditor } from './WaterfallOrderEditor';
import { CashBufferRuleForm } from './CashBufferRuleForm';
import { IncomeAndBenefitsForm } from './IncomeAndBenefitsForm';
import { ImportExportPanel } from './ImportExportPanel';

export function ScenarioSetupTab() {
  const { data: scenarios = [], isLoading } = useScenarios();
  const { activeScenarioId, setActiveScenarioId } = useActiveScenario();
  const saveScenario = useSaveScenario();

  const activeScenario = scenarios.find((s) => s.id === activeScenarioId) ?? null;

  const form = useForm<Scenario>({
    resolver: zodResolver(ScenarioSchema),
    defaultValues: activeScenario ?? undefined,
  });

  useEffect(() => {
    if (activeScenario) form.reset(activeScenario);
    // Re-sync whenever the active scenario changes OR gets updated
    // externally (e.g. a merge import overwriting the same id).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScenario?.id, activeScenario?.updatedAt]);

  // Sub-forms call watch() on array fields (accountBuckets, waterfall, ...)
  // unconditionally. form.watch('id') is reactive - it re-renders this
  // component once reset() above actually lands - so gating on it (rather
  // than a separate setState-in-effect flag) holds off rendering children
  // until the form is populated for the current scenario, with no risk of
  // the render right after creating/switching a scenario seeing undefined
  // arrays and crashing.
  const formScenarioId = form.watch('id');

  async function createAndActivate(country: 'US' | 'CA') {
    const scenario = createDefaultScenario(country);
    await saveScenario.mutateAsync(scenario);
    setActiveScenarioId(scenario.id);
  }

  if (isLoading) return null;

  if (!activeScenario) {
    return (
      <DashCard className="text-center py-12">
        <p className="mb-4 text-ink">Create your first scenario to get started.</p>
        <div className="flex justify-center gap-2">
          <Button onClick={() => createAndActivate('US')}>United States</Button>
          <Button variant="outline" onClick={() => createAndActivate('CA')}>
            Canada
          </Button>
        </div>
      </DashCard>
    );
  }

  if (formScenarioId !== activeScenario.id) return null;

  const onSubmit = form.handleSubmit(async (values) => {
    await saveScenario.mutateAsync({ ...values, updatedAt: new Date().toISOString() });
  });

  const invalidFieldCount = Object.keys(form.formState.errors).length;

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="flex justify-end items-center gap-3">
          {invalidFieldCount > 0 && (
            <span className="text-[13px] text-loss">
              {invalidFieldCount} field{invalidFieldCount > 1 ? 's need' : ' needs'} attention before saving.
            </span>
          )}
          <Button type="submit" disabled={saveScenario.isPending}>
            {saveScenario.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
        <GlobalParametersForm />
        <AccountBucketsEditor />
        <TaxAssumptionsForm />
        <WaterfallOrderEditor />
        <CashBufferRuleForm />
        <IncomeAndBenefitsForm />
        <ImportExportPanel />
      </form>
    </Form>
  );
}
