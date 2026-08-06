import { Controller, useFormContext } from 'react-hook-form';
import { DashCard } from '../../components/DashCard';
import { Label } from '@repo/ui/components/label';
import { MoneyInput } from '../../components/MoneyInput';
import type { Scenario } from '../../engine/schema';

/**
 * The household's budget, in one place. There is no per-person split to show:
 * the budget is funded from household income first and then from a single
 * ordered pass over every account, so what a person "spends" is an outcome of
 * the Withdrawal Order rather than an input.
 */
export function HouseholdSpendingForm() {
  const { control, watch } = useFormContext<Scenario>();
  const persons = watch('persons') ?? [];

  const retirementYears = persons.map((p) => p.retirementStartYear).filter((y): y is number => y !== null && y !== undefined);
  const earliestRetirementYear = retirementYears.length > 0 ? Math.min(...retirementYears) : null;

  return (
    <DashCard>
      <h3 className="text-[15px] font-semibold text-ink mb-1">Household Spending</h3>
      <p className="text-[12.5px] text-dim mb-4">
        What the household spends per year in today's dollars, funded from the household's accounts as a whole.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="space-y-1.5">
          <Label>Before retirement (real $)</Label>
          <Controller control={control} name="householdSpendingRealBeforeRetirement" render={({ field }) => <MoneyInput value={field.value} onChange={(v) => field.onChange(v ?? 0)} />} />
        </div>
        <div className="space-y-1.5">
          <Label>At retirement (real $)</Label>
          <Controller control={control} name="householdSpendingRealAtRetirement" render={({ field }) => <MoneyInput value={field.value} onChange={(v) => field.onChange(v ?? 0)} />} />
        </div>
      </div>

      <p className="text-[11.5px] text-dim mt-2">
        {earliestRetirementYear === null
          ? 'Nobody has a retirement year set, so the before-retirement figure applies throughout.'
          : `Switches to the at-retirement figure in ${earliestRetirementYear}, when the first person retires.`}
      </p>

      <p className="text-[11.5px] text-dim mt-3">
        This is funded from the household's income first, then by drawing down accounts in the order set below — across everyone's accounts, not just
        the account holder's. Each person's Spending column in the Planning Grid shows what they actually funded.
      </p>
    </DashCard>
  );
}
