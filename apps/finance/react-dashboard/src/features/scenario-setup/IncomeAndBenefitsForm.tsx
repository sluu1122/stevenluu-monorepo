import { Controller, useFieldArray, useFormContext } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { DashCard } from '../../components/DashCard';
import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { MoneyInput } from '../../components/MoneyInput';
import type { Scenario } from '../../engine/schema';
import { generateId } from '../../engine/id';

export function IncomeAndBenefitsForm() {
  const { register, control, watch } = useFormContext<Scenario>();
  const { fields, append, remove } = useFieldArray({ control, name: 'incomeSources' });
  const benefits = watch('benefits');

  return (
    <>
      <DashCard>
        <h3 className="text-[15px] font-semibold text-ink mb-1">Inflation</h3>
        <p className="text-[12.5px] text-dim mb-4">A flat annual rate compounds nominal spending forward each year in retirement.</p>
        <div className="space-y-1.5 max-w-[220px]">
          <Label>Flat annual rate %</Label>
          <Input type="number" step="0.1" {...register('inflation.flatRatePct', { valueAsNumber: true })} />
        </div>
      </DashCard>

      <DashCard>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[15px] font-semibold text-ink">Other Income Sources</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({
                id: generateId('income'),
                label: 'New income',
                owner: 'self',
                startYear: new Date().getFullYear(),
                annualAmountNominal: 0,
                growthRatePct: 0,
              })
            }
          >
            <Plus className="size-3.5" /> Add
          </Button>
        </div>
        <p className="text-[12.5px] text-dim mb-4">Rental income, part-time work, annuities, etc. - separate from the pensions/benefits below.</p>
        <div className="flex flex-col gap-3">
          {fields.length === 0 && <p className="text-[13px] text-dim">No additional income sources.</p>}
          {fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end border-b border-edge pb-3 last:border-0">
              <div className="col-span-2 sm:col-span-1 space-y-1.5">
                <Label>Label</Label>
                <Input {...register(`incomeSources.${index}.label`)} />
              </div>
              <div className="space-y-1.5">
                <Label>Start year</Label>
                <Input
                  type="number"
                  {...register(`incomeSources.${index}.startYear`, {
                    setValueAs: (v) => (v === '' ? undefined : Math.round(Number(v))),
                  })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Annual amount</Label>
                <Controller
                  control={control}
                  name={`incomeSources.${index}.annualAmountNominal`}
                  render={({ field }) => <MoneyInput value={field.value} onChange={field.onChange} />}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Growth %</Label>
                <Input type="number" step="0.1" {...register(`incomeSources.${index}.growthRatePct`, { valueAsNumber: true })} />
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} aria-label="Remove income source">
                <Trash2 className="size-4 text-loss" />
              </Button>
            </div>
          ))}
        </div>
      </DashCard>

      <DashCard>
        <h3 className="text-[15px] font-semibold text-ink mb-1">Pensions & Benefits</h3>
        <p className="text-[12.5px] text-dim mb-4">Seeded 2026 maximums are suggested defaults - enter your own monthly estimate and claim age.</p>
        <div className="flex flex-col gap-3">
          {benefits.map((benefit, index) => (
            <div key={benefit.type} className="grid grid-cols-3 gap-3 items-end border-b border-edge pb-3 last:border-0">
              <Label className="!mt-0">{benefit.type.replace(/_/g, ' ')}</Label>
              <div className="space-y-1.5">
                <Label>Claim age</Label>
                <Input
                  type="number"
                  {...register(`benefits.${index}.claimAge`, {
                    setValueAs: (v) => (v === '' ? undefined : Math.round(Number(v))),
                  })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Monthly at claim ($)</Label>
                <Controller
                  control={control}
                  name={`benefits.${index}.monthlyBenefitAtClaimAge`}
                  render={({ field }) => <MoneyInput value={field.value} onChange={field.onChange} />}
                />
              </div>
            </div>
          ))}
        </div>
      </DashCard>
    </>
  );
}
