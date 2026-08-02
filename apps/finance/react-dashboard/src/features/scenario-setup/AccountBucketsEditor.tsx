import { Controller, useFormContext } from 'react-hook-form';
import { DashCard } from '../../components/DashCard';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { Badge } from '@repo/ui/components/badge';
import { MoneyInput } from '../../components/MoneyInput';
import type { Scenario } from '../../engine/schema';

export function AccountBucketsEditor() {
  const { register, control, watch } = useFormContext<Scenario>();
  const buckets = watch('accountBuckets');

  return (
    <DashCard>
      <h3 className="text-[15px] font-semibold text-ink mb-1">Account Buckets</h3>
      <p className="text-[12.5px] text-dim mb-4">Starting balances and assumed return rates per account.</p>
      <div className="flex flex-col gap-4">
        {buckets.map((bucket, index) => (
          <div key={bucket.id} className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end border-b border-edge pb-4 last:border-0 last:pb-0">
            <div className="col-span-2 sm:col-span-1 space-y-1.5">
              <Label className="flex items-center gap-1.5">
                {bucket.label}
                {bucket.isCashBuffer && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    Cash buffer
                  </Badge>
                )}
              </Label>
              <Input {...register(`accountBuckets.${index}.label`)} />
            </div>
            <div className="space-y-1.5">
              <Label>Starting balance</Label>
              <Controller
                control={control}
                name={`accountBuckets.${index}.startingBalance`}
                render={({ field }) => <MoneyInput value={field.value} onChange={field.onChange} />}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Pre-retirement return %</Label>
              <Input type="number" step="0.1" {...register(`accountBuckets.${index}.preRetirementReturnPct`, { valueAsNumber: true })} />
            </div>
            <div className="space-y-1.5">
              <Label>Post-retirement return %</Label>
              <Input type="number" step="0.1" {...register(`accountBuckets.${index}.postRetirementReturnPct`, { valueAsNumber: true })} />
            </div>
            <div className="space-y-1.5">
              <Label>Annual contribution</Label>
              <Controller
                control={control}
                name={`accountBuckets.${index}.annualContributionWhileWorking`}
                render={({ field }) => <MoneyInput value={field.value} onChange={field.onChange} />}
              />
            </div>
          </div>
        ))}
      </div>
    </DashCard>
  );
}
