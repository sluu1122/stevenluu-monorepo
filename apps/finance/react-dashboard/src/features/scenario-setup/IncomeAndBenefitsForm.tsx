import { useState } from 'react';
import { Controller, useFieldArray, useFormContext } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { DashCard } from '../../components/DashCard';
import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/select';
import { MoneyInput } from '../../components/MoneyInput';
import type { BenefitType, Scenario } from '../../engine/schema';
import { generateId } from '../../engine/id';

const BENEFIT_TYPE_LABELS: Record<BenefitType, string> = {
  US_SOCIAL_SECURITY: 'US Social Security',
  CA_CPP: 'CPP',
  CA_OAS: 'OAS',
};

export function IncomeAndBenefitsForm() {
  const { register, control, watch } = useFormContext<Scenario>();
  const { fields: incomeFields, append: appendIncome, remove: removeIncome } = useFieldArray({ control, name: 'incomeSources' });
  const { fields: benefitFields, append: appendBenefit, remove: removeBenefit } = useFieldArray({ control, name: 'benefits' });
  const persons = watch('household.persons');
  const showWhoseBenefit = persons.length > 1;
  const [benefitTypeToAdd, setBenefitTypeToAdd] = useState<BenefitType | ''>('');

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
            className="cursor-pointer"
            onClick={() =>
              appendIncome({
                id: generateId('income'),
                label: 'New income',
                startYear: new Date().getFullYear(),
                annualAmountNominal: 0,
                growthRatePct: 0,
              })
            }
          >
            <Plus className="size-3.5" /> Add
          </Button>
        </div>
        <p className="text-[12.5px] text-dim mb-4">Rental income, part-time work, annuities, etc. - separate from each person's own income in the Household section above.</p>
        <div className="flex flex-col gap-3">
          {incomeFields.length === 0 && <p className="text-[13px] text-dim">No additional income sources.</p>}
          {incomeFields.map((field, index) => (
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
                  render={({ field: moneyField }) => <MoneyInput value={moneyField.value} onChange={moneyField.onChange} />}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Growth %</Label>
                <Input type="number" step="0.1" {...register(`incomeSources.${index}.growthRatePct`, { valueAsNumber: true })} />
              </div>
              <Button type="button" variant="ghost" size="icon" className="cursor-pointer" onClick={() => removeIncome(index)} aria-label="Remove income source">
                <Trash2 className="size-4 text-loss" />
              </Button>
            </div>
          ))}
        </div>
      </DashCard>

      <DashCard>
        <h3 className="text-[15px] font-semibold text-ink mb-1">Pensions &amp; Benefits</h3>
        <p className="text-[12.5px] text-dim mb-4">Seeded 2026 maximums are suggested defaults - enter your own monthly estimate and claim age.</p>
        <div className="flex flex-col gap-3">
          {benefitFields.length === 0 && <p className="text-[13px] text-dim">No benefits added.</p>}
          {benefitFields.map((field, index) => (
            <div key={field.id} className={`grid grid-cols-2 ${showWhoseBenefit ? 'sm:grid-cols-5' : 'sm:grid-cols-4'} gap-3 items-end border-b border-edge pb-3 last:border-0`}>
              <Label className="!mt-0 col-span-2 sm:col-span-1">{BENEFIT_TYPE_LABELS[field.type]}</Label>
              {showWhoseBenefit && (
                <div className="space-y-1.5">
                  <Label>Whose benefit</Label>
                  <Controller
                    control={control}
                    name={`benefits.${index}.personId`}
                    render={({ field: personField }) => (
                      <Select value={personField.value} onValueChange={personField.onChange}>
                        <SelectTrigger className="cursor-pointer">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {persons.map((person) => (
                            <SelectItem key={person.id} value={person.id}>
                              {person.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              )}
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
                  render={({ field: moneyField }) => <MoneyInput value={moneyField.value} onChange={moneyField.onChange} />}
                />
              </div>
              <Button type="button" variant="ghost" size="icon" className="cursor-pointer" onClick={() => removeBenefit(index)} aria-label={`Remove ${BENEFIT_TYPE_LABELS[field.type]}`}>
                <Trash2 className="size-4 text-loss" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex items-end gap-2 mt-4 pt-4 border-t border-edge">
          <div className="space-y-1.5 flex-1 max-w-[220px]">
            <Label>Add benefit</Label>
            <Select value={benefitTypeToAdd} onValueChange={(v: string) => setBenefitTypeToAdd(v as BenefitType)}>
              <SelectTrigger className="cursor-pointer">
                <SelectValue placeholder="Choose a benefit..." />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(BENEFIT_TYPE_LABELS) as BenefitType[]).map((type) => (
                  <SelectItem key={type} value={type}>
                    {BENEFIT_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            disabled={!benefitTypeToAdd}
            onClick={() => {
              if (!benefitTypeToAdd) return;
              appendBenefit({ type: benefitTypeToAdd, personId: persons[0].id, claimAge: 65, monthlyBenefitAtClaimAge: 0, colaPct: 2.8 });
              setBenefitTypeToAdd('');
            }}
          >
            <Plus className="size-3.5" /> Add
          </Button>
        </div>
      </DashCard>
    </>
  );
}
