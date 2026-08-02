import { Controller, useFieldArray, useFormContext } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { DashCard } from '../../components/DashCard';
import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { MoneyInput } from '../../components/MoneyInput';
import { generateId } from '../../engine/id';
import type { Scenario } from '../../engine/schema';

export function PersonsForm() {
  const { register, control, watch, setValue } = useFormContext<Scenario>();
  const { fields, append, remove } = useFieldArray({ control, name: 'household.persons' });
  const benefits = watch('benefits');

  function addPerson() {
    append({
      id: generateId('person'),
      label: `Person ${fields.length + 1}`,
      birthYear: new Date().getFullYear() - 35,
      planningEndAge: 95,
      retirementStartYear: null,
      annualIncomeNominal: 0,
      incomeGrowthRatePct: 0,
    });
  }

  function removePerson(index: number) {
    const removedId = fields[index].id;
    const primaryId = fields[0].id;
    // Reassign any benefit that belonged to the removed person back to
    // Person 1 rather than leaving it pointing at a person that no longer exists.
    if (removedId !== primaryId) {
      const targetId = index === 0 ? fields[1]?.id : primaryId;
      setValue(
        'benefits',
        benefits.map((b) => (b.personId === removedId ? { ...b, personId: targetId ?? primaryId } : b)),
        { shouldDirty: true },
      );
    }
    remove(index);
  }

  return (
    <DashCard>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[15px] font-semibold text-ink">Household</h3>
        <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={addPerson}>
          <Plus className="size-3.5" /> Add Person
        </Button>
      </div>
      <p className="text-[12.5px] text-dim mb-4">
        Each person has their own birth year (their benefit claim age resolves against it independently), planning end age, retirement start year,
        and income - which stops automatically at their own retirement. Account buckets stay one shared household pool regardless.
      </p>
      <div className="flex flex-col gap-4">
        {fields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-2 sm:grid-cols-6 gap-3 items-end border-b border-edge pb-4 last:border-0 last:pb-0">
            <div className="col-span-2 sm:col-span-1 space-y-1.5">
              <Label>Label</Label>
              <Input {...register(`household.persons.${index}.label`)} />
            </div>
            <div className="space-y-1.5">
              <Label>Birth year</Label>
              <Input
                type="number"
                {...register(`household.persons.${index}.birthYear`, {
                  setValueAs: (v) => (v === '' ? undefined : Math.round(Number(v))),
                })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Planning end age</Label>
              <Input
                type="number"
                {...register(`household.persons.${index}.planningEndAge`, {
                  setValueAs: (v) => (v === '' ? undefined : Math.round(Number(v))),
                })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Retirement start year</Label>
              <Controller
                control={control}
                name={`household.persons.${index}.retirementStartYear`}
                render={({ field: yearField }) => (
                  <Input
                    type="number"
                    placeholder="Not set"
                    value={yearField.value ?? ''}
                    onChange={(e) => yearField.onChange(e.target.value === '' ? null : Math.round(Number(e.target.value)))}
                  />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Income</Label>
              <Controller
                control={control}
                name={`household.persons.${index}.annualIncomeNominal`}
                render={({ field: incomeField }) => <MoneyInput value={incomeField.value} onChange={incomeField.onChange} />}
              />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label>Income raise %</Label>
                <Input type="number" step="0.1" {...register(`household.persons.${index}.incomeGrowthRatePct`, { valueAsNumber: true })} />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="cursor-pointer text-loss hover:text-loss"
                onClick={() => removePerson(index)}
                aria-label={`Remove ${field.label || `Person ${index + 1}`}`}
                disabled={fields.length <= 1}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </DashCard>
  );
}
