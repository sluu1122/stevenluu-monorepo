import { useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { DashCard } from '../../components/DashCard';
import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { Badge } from '@repo/ui/components/badge';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@repo/ui/components/select';
import { MoneyInput } from '../../components/MoneyInput';
import { ACCOUNT_KIND_META, CA_ACCOUNT_KINDS, US_ACCOUNT_KINDS, createBlankAccountBucket } from '../../engine/accountKindMeta';
import type { AccountKind, Scenario } from '../../engine/schema';

export function AccountBucketsEditor() {
  const { register, control, watch, setValue } = useFormContext<Scenario>();
  const buckets = watch('accountBuckets');
  const waterfall = watch('waterfall');
  const replenishmentOrder = watch('cashBufferRule.replenishmentOrder');
  const [kindToAdd, setKindToAdd] = useState<AccountKind | ''>('');

  function addAccount() {
    if (!kindToAdd) return;
    const bucket = createBlankAccountBucket(kindToAdd);
    setValue('accountBuckets', [...buckets, bucket], { shouldDirty: true });
    setValue('waterfall', [...waterfall, { order: waterfall.length, accountBucketId: bucket.id }], { shouldDirty: true });
    if (!bucket.isCashBuffer) {
      setValue('cashBufferRule.replenishmentOrder', [...replenishmentOrder, bucket.id], { shouldDirty: true });
    }
    setKindToAdd('');
  }

  function removeAccount(bucketId: string) {
    setValue(
      'accountBuckets',
      buckets.filter((b) => b.id !== bucketId),
      { shouldDirty: true },
    );
    setValue(
      'waterfall',
      waterfall.filter((w) => w.accountBucketId !== bucketId).map((w, i) => ({ ...w, order: i })),
      { shouldDirty: true },
    );
    setValue(
      'cashBufferRule.replenishmentOrder',
      replenishmentOrder.filter((id) => id !== bucketId),
      { shouldDirty: true },
    );
  }

  return (
    <DashCard>
      <h3 className="text-[15px] font-semibold text-ink mb-1">Account Buckets</h3>
      <p className="text-[12.5px] text-dim mb-4">
        Starting balances and assumed return rates per account. Mix US and Canadian account kinds freely for dual-citizen or cross-border scenarios.
      </p>
      <div className="flex flex-col gap-4">
        {buckets.map((bucket, index) => (
          <div key={bucket.id} className="grid grid-cols-2 sm:grid-cols-6 gap-3 items-end border-b border-edge pb-4 last:border-0 last:pb-0">
            <div className="col-span-2 sm:col-span-1 space-y-1.5">
              <Label className="flex items-center gap-1.5 flex-wrap">
                {bucket.label}
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {bucket.country}
                </Badge>
                {bucket.isCashBuffer && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    Cash buffer
                  </Badge>
                )}
              </Label>
              <Input {...register(`accountBuckets.${index}.label`)} />
            </div>
            <div className="space-y-1.5">
              <Label>Starting balance ({bucket.country === 'US' ? 'USD' : 'CAD'})</Label>
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
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="cursor-pointer text-loss hover:text-loss"
                onClick={() => removeAccount(bucket.id)}
                aria-label={`Remove ${bucket.label}`}
                disabled={buckets.length <= 1}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-end gap-2 mt-4 pt-4 border-t border-edge">
        <div className="space-y-1.5 flex-1 max-w-[280px]">
          <Label>Add account</Label>
          <Select value={kindToAdd} onValueChange={(v: string) => setKindToAdd(v as AccountKind)}>
            <SelectTrigger className="cursor-pointer">
              <SelectValue placeholder="Choose an account kind..." />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>United States</SelectLabel>
                {US_ACCOUNT_KINDS.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {ACCOUNT_KIND_META[kind].label}
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Canada</SelectLabel>
                {CA_ACCOUNT_KINDS.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {ACCOUNT_KIND_META[kind].label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="outline" className="cursor-pointer" onClick={addAccount} disabled={!kindToAdd}>
          <Plus className="size-3.5" /> Add
        </Button>
      </div>
    </DashCard>
  );
}
