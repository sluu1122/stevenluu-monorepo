import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { Form } from '@repo/ui/components/form';
import { Button } from '@repo/ui/components/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/tabs';
import { DashCard } from '../../components/DashCard';
import { useActiveScenario } from '../../hooks/useActiveScenario';
import { useScenarios, useSaveScenario } from '../../hooks/useScenarios';
import { ScenarioSchema, type Scenario } from '../../engine/schema';
import { createDefaultPersonPlan, createDefaultScenario } from '../../engine/defaults';
import { GlobalParametersForm } from './GlobalParametersForm';
import { HouseholdSpendingForm } from './HouseholdSpendingForm';
import { HouseholdWithdrawalOrderForm } from './HouseholdWithdrawalOrderForm';
import { AccountAvailabilityForm } from './AccountAvailabilityForm';
import { PersonDetailsForm } from './PersonDetailsForm';
import { AccountBucketsEditor } from './AccountBucketsEditor';
import { TaxAssumptionsForm } from './TaxAssumptionsForm';
import { CashBufferRuleForm } from './CashBufferRuleForm';
import { MeltdownRulesForm } from './MeltdownRulesForm';
import { RequiredDistributionsForm } from './RequiredDistributionsForm';
import { IncomeAndBenefitsForm } from './IncomeAndBenefitsForm';
import { InflationForm } from './InflationForm';
import { SharedAccountsEditor } from './SharedAccountsEditor';
import { SharedCashBufferForm } from './SharedCashBufferForm';
import { TaxableAccountTaxationForm } from './TaxableAccountTaxationForm';

const SCENARIO_TAB = 'scenario';

export function ScenarioSetupTab() {
  const { data: scenarios = [], isLoading } = useScenarios();
  const { activeScenarioId, setActiveScenarioId } = useActiveScenario();
  const saveScenario = useSaveScenario();
  const [activeSubTab, setActiveSubTab] = useState<string>(SCENARIO_TAB);

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
  // unconditionally. form.watch() is reactive - it re-renders this component
  // once reset() above actually lands - so gating on watchedValues.id (rather
  // than a separate setState-in-effect flag) holds off rendering children
  // until the form is populated for the current scenario, with no risk of
  // the render right after creating/switching a scenario seeing undefined
  // arrays and crashing.
  const watchedValues = form.watch();
  const formScenarioId = watchedValues.id;

  // RHF's own formState.isDirty doesn't reliably clear after reset() on an
  // object this large/nested (dirtyFields entries from before the reset can
  // survive it) - comparing the live watched values against the last-known
  // persisted scenario directly sidesteps that rather than fighting it.
  const hasUnsavedChanges = JSON.stringify(watchedValues) !== JSON.stringify(activeScenario);

  async function createAndActivate() {
    const scenario = createDefaultScenario('CA');
    await saveScenario.mutateAsync(scenario);
    setActiveScenarioId(scenario.id);
  }

  if (isLoading) return null;

  if (!activeScenario) {
    return (
      <DashCard className="text-center py-12">
        <p className="mb-4 text-ink">Create your first scenario to get started.</p>
        <div className="flex justify-center gap-2">
          <Button className="cursor-pointer" onClick={() => createAndActivate()}>
            Create Scenario
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
  const persons = watchedValues.persons ?? [];

  function addPerson() {
    const person = createDefaultPersonPlan(activeScenario!.country, `Person ${persons.length + 1}`);
    form.setValue('persons', [...persons, person], { shouldDirty: true });
    setActiveSubTab(person.id);
  }

  function removePerson(personId: string) {
    const next = persons.filter((p) => p.id !== personId);
    form.setValue('persons', next, { shouldDirty: true });
    setActiveSubTab(next[0]?.id ?? SCENARIO_TAB);
  }

  return (
    <Form {...form}>
      {/*
        One form across every tab. RHF's default shouldUnregister:false keeps
        a hidden tab's values registered, so switching tabs never drops edits
        and a single Save covers the whole scenario.
      */}
      {/* pb on the form, not margin on the pill: the pill is `fixed`, so it's
          out of flow and can't push anything. Without the padding it sits on
          top of the last field on a phone. */}
      <form onSubmit={onSubmit} className="flex flex-col gap-5 pb-20 sm:pb-0">
        {/*
          Stays `fixed` rather than `sticky` - <main> is the scroll container,
          not the document, so sticky would resolve against the wrong box.
          Spanning to left-4 below sm gives the "n fields need attention" text
          room instead of letting it squeeze the button.
        */}
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:bottom-6 sm:right-6 z-40 print:hidden flex items-center justify-end gap-3 rounded-full border border-edge bg-surface-raised shadow-lg px-3 py-2">
          {invalidFieldCount > 0 && (
            <span className="text-[13px] text-loss pl-1">
              {invalidFieldCount} field{invalidFieldCount > 1 ? 's need' : ' needs'} attention
            </span>
          )}
          <Button type="submit" className="cursor-pointer rounded-full" disabled={saveScenario.isPending || !hasUnsavedChanges}>
            {saveScenario.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>

        <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="flex flex-col gap-5">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Wrap rather than scroll: TabsList is a fixed h-10, so an
                overflowing scrollbar was rendering inside that 40px and
                clipping the trigger text. h-auto lets a second row exist. */}
            <TabsList className="justify-start flex-wrap h-auto">
              <TabsTrigger value={SCENARIO_TAB} className="cursor-pointer">
                Household
              </TabsTrigger>
              {persons.map((person) => (
                <TabsTrigger key={person.id} value={person.id} className="cursor-pointer">
                  {person.label || 'Unnamed'}
                </TabsTrigger>
              ))}
            </TabsList>
            <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={addPerson}>
              <Plus className="size-3.5" /> Add Person
            </Button>
          </div>

          <TabsContent value={SCENARIO_TAB} className="flex flex-col gap-5">
            <GlobalParametersForm />
            <HouseholdSpendingForm />
            <HouseholdWithdrawalOrderForm />
            <SharedAccountsEditor />
            <SharedCashBufferForm />
            <AccountAvailabilityForm />
            <TaxAssumptionsForm />
            <TaxableAccountTaxationForm />
            <InflationForm />
          </TabsContent>

          {persons.map((person, personIndex) => (
            <TabsContent key={person.id} value={person.id} className="flex flex-col gap-5">
              <PersonDetailsForm personIndex={personIndex} />
              <AccountBucketsEditor personIndex={personIndex} />
              <CashBufferRuleForm personIndex={personIndex} />
              <MeltdownRulesForm personIndex={personIndex} />
              <RequiredDistributionsForm personIndex={personIndex} />
              <IncomeAndBenefitsForm personIndex={personIndex} />
              <div className="flex justify-end pb-4">
                <Button
                  type="button"
                  variant="outline"
                  className="cursor-pointer text-loss hover:text-loss"
                  onClick={() => removePerson(person.id)}
                  disabled={persons.length <= 1}
                >
                  <Trash2 className="size-3.5" /> Remove {person.label || 'this person'}
                </Button>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </form>
    </Form>
  );
}
