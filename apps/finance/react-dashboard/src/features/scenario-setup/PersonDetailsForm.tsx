import { Controller, useFormContext } from 'react-hook-form';
import { Info } from 'lucide-react';
import { DashCard } from '../../components/DashCard';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/select';
import { MoneyInput } from '../../components/MoneyInput';
import type { Scenario } from '../../engine/schema';

export function PersonDetailsForm({ personIndex }: { personIndex: number }) {
  const { register, control, watch, setValue } = useFormContext<Scenario>();
  const ownBuckets = watch(`persons.${personIndex}.accountBuckets`) ?? [];
  const sharedBuckets = watch('sharedAccountBuckets') ?? [];
  const surplusDestinationId = watch(`persons.${personIndex}.surplusDestinationAccountBucketId`);
  const ownCashBucket = ownBuckets.find((b) => b.isCashBuffer);

  // Deliberately keyed off form state alone rather than the projected surplus:
  // the ledger reflects the last *saved* scenario, so a magnitude threshold
  // would lag whatever the user is typing right now by a full save. Anyone
  // earning with no destination set is banking surplus to cash regardless -
  // only the size of the effect is unknown, so this informs rather than alarms.
  const surplusFallsBackToCash = surplusDestinationId == null && (watch(`persons.${personIndex}.annualIncomeNominal`) ?? 0) > 0;

  return (
    <DashCard>
      <h3 className="text-[15px] font-semibold text-ink mb-1">Person Details</h3>
      <p className="text-[12.5px] text-dim mb-4">
        This person's own timeline and money. Their income stops at their own retirement year, their benefit claim ages resolve against their own
        birth year, and their spending is covered by their own accounts - nobody else's.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input {...register(`persons.${personIndex}.label`)} />
        </div>
        <div className="space-y-1.5">
          <Label>Birth year</Label>
          <Input
            type="number"
            {...register(`persons.${personIndex}.birthYear`, { setValueAs: (v) => (v === '' ? undefined : Math.round(Number(v))) })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Planning end age</Label>
          <Input
            type="number"
            {...register(`persons.${personIndex}.planningEndAge`, { setValueAs: (v) => (v === '' ? undefined : Math.round(Number(v))) })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Retirement start year</Label>
          <Controller
            control={control}
            name={`persons.${personIndex}.retirementStartYear`}
            render={({ field }) => (
              <Input
                type="number"
                placeholder="Not set"
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value === '' ? null : Math.round(Number(e.target.value)))}
              />
            )}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Income</Label>
          <Controller
            control={control}
            name={`persons.${personIndex}.annualIncomeNominal`}
            render={({ field }) => <MoneyInput value={field.value} onChange={field.onChange} />}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Income raise %</Label>
          <Input type="number" step="0.1" {...register(`persons.${personIndex}.incomeGrowthRatePct`, { valueAsNumber: true })} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Bank income surplus into</Label>
          <Select
            value={surplusDestinationId ?? ''}
            onValueChange={(v: string) =>
              setValue(`persons.${personIndex}.surplusDestinationAccountBucketId`, v === '__default__' ? null : v, { shouldDirty: true })
            }
          >
            <SelectTrigger className="cursor-pointer">
              <SelectValue placeholder={ownCashBucket ? `Default (${ownCashBucket.label})` : 'Default (own cash buffer)'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__default__">{ownCashBucket ? `Default (${ownCashBucket.label})` : 'Default (own cash buffer)'}</SelectItem>
              {ownBuckets.map((bucket) => (
                <SelectItem key={bucket.id} value={bucket.id}>
                  {bucket.label}
                </SelectItem>
              ))}
              {sharedBuckets.map((bucket) => (
                <SelectItem key={bucket.id} value={bucket.id}>
                  {bucket.label} (Shared)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11.5px] text-dim">
            Where money left over after this person's spending and tax goes each year. Point it at a shared account to have their earnings fund the
            household.
          </p>
          {surplusFallsBackToCash && (
            <p className="flex items-start gap-1.5 text-[11.5px] text-indigo">
              <Info className="size-3.5 shrink-0 mt-[1px]" />
              <span>
                Left on the default, this surplus piles up in {ownCashBucket ? ownCashBucket.label : 'the cash buffer'} at cash returns instead of
                being invested, which compounds into a large difference over a full career. Pick an investment account if the money would really be
                invested.
              </span>
            </p>
          )}
        </div>
      </div>
    </DashCard>
  );
}
