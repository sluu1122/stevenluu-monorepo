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
  CA_CPP: 'Canada Pension Plan',
  CA_OAS: 'Old Age Security',
};

export function IncomeAndBenefitsForm({ personIndex }: { personIndex: number }) {
  const { register, control } = useFormContext<Scenario>();
  const { fields: incomeFields, append: appendIncome, remove: removeIncome } = useFieldArray({ control, name: `persons.${personIndex}.incomeSources` });
  const { fields: benefitFields, append: appendBenefit, remove: removeBenefit } = useFieldArray({ control, name: `persons.${personIndex}.benefits` });
  const [benefitTypeToAdd, setBenefitTypeToAdd] = useState<BenefitType | ''>('');

  return (
    <>
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
        <p className="text-[12.5px] text-dim mb-4">
          Rental income, part-time work, annuities, etc. - separate from this person's own income in Person Details above, and counted only against
          their taxable income.
        </p>
        <div className="flex flex-col gap-3">
          {incomeFields.length === 0 && <p className="text-[13px] text-dim">No additional income sources.</p>}
          {incomeFields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end border-b border-edge pb-3 last:border-0">
              <div className="col-span-2 sm:col-span-1 space-y-1.5">
                <Label>Label</Label>
                <Input {...register(`persons.${personIndex}.incomeSources.${index}.label`)} />
              </div>
              <div className="space-y-1.5">
                <Label>Start year</Label>
                <Input
                  type="number"
                  {...register(`persons.${personIndex}.incomeSources.${index}.startYear`, {
                    setValueAs: (v) => (v === '' ? undefined : Math.round(Number(v))),
                  })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Annual amount</Label>
                <Controller
                  control={control}
                  name={`persons.${personIndex}.incomeSources.${index}.annualAmountNominal`}
                  render={({ field: moneyField }) => <MoneyInput value={moneyField.value} onChange={moneyField.onChange} />}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Growth %</Label>
                <Input type="number" step="0.1" {...register(`persons.${personIndex}.incomeSources.${index}.growthRatePct`, { valueAsNumber: true })} />
              </div>
              <Button type="button" variant="ghost" size="icon" className="cursor-pointer" onClick={() => removeIncome(index)} aria-label="Remove income source">
                <Trash2 className="size-4 text-loss" />
              </Button>
            </div>
          ))}
        </div>
      </DashCard>

      <DashCard>
        <h3 className="text-[15px] font-semibold text-ink mb-1">Government Benefits</h3>
        <p className="text-[12.5px] text-dim mb-4">
          Claim ages resolve against this person's own birth year. Seeded 2026 maximums are suggested defaults - enter your own monthly estimate and
          claim age.
        </p>
        <div className="flex flex-col gap-3">
          {benefitFields.length === 0 && <p className="text-[13px] text-dim">No benefits added.</p>}
          {benefitFields.map((field, index) => (
            <div key={field.id} className="border-b border-edge pb-4 last:border-0 last:pb-0">
              <div className="flex items-center justify-between gap-3 mb-3">
                <Label className="!mt-0 font-semibold">{BENEFIT_TYPE_LABELS[field.type]}</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="cursor-pointer"
                  onClick={() => removeBenefit(index)}
                  aria-label={`Remove ${BENEFIT_TYPE_LABELS[field.type]}`}
                >
                  <Trash2 className="size-4 text-loss" />
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-[420px]">
                <div className="space-y-1.5">
                  <Label>Claim age</Label>
                  <Input
                    type="number"
                    {...register(`persons.${personIndex}.benefits.${index}.claimAge`, {
                      setValueAs: (v) => (v === '' ? undefined : Math.round(Number(v))),
                    })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Monthly at claim ($)</Label>
                  <Controller
                    control={control}
                    name={`persons.${personIndex}.benefits.${index}.monthlyBenefitAtClaimAge`}
                    render={({ field: moneyField }) => <MoneyInput value={moneyField.value} onChange={moneyField.onChange} />}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-end gap-2 mt-4 pt-4 border-t border-edge">
          {/* Explicit heights (rather than auto, from items-end) - a hidden
              native <select> Radix renders for progressive enhancement adds
              a few px of phantom height to its own auto-sized ancestor,
              which would otherwise throw off alignment with the button. */}
          <div className="space-y-1.5 flex-1 max-w-[220px] h-16">
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
              appendBenefit({ type: benefitTypeToAdd, claimAge: 65, monthlyBenefitAtClaimAge: 0, colaPct: 2.8 });
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
