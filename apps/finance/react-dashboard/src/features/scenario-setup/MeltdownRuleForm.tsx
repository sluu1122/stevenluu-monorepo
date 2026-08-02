import { useFormContext } from 'react-hook-form';
import { DashCard } from '../../components/DashCard';
import { Checkbox } from '@repo/ui/components/checkbox';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { Switch } from '@repo/ui/components/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/select';
import { MoneyInput } from '../../components/MoneyInput';
import { DEFAULT_MELTDOWN_RULE } from '../../engine/schema';
import type { Scenario } from '../../engine/schema';

export function MeltdownRuleForm() {
  const { watch, setValue } = useFormContext<Scenario>();
  const rule = watch('meltdownRule') ?? DEFAULT_MELTDOWN_RULE;
  const buckets = watch('accountBuckets');
  const taxDeferredBuckets = buckets.filter((b) => b.taxTreatment === 'taxDeferred');

  function toggleSource(bucketId: string, checked: boolean) {
    const next = checked ? [...rule.sourceAccountBucketIds, bucketId] : rule.sourceAccountBucketIds.filter((id) => id !== bucketId);
    setValue('meltdownRule', { ...rule, sourceAccountBucketIds: next }, { shouldDirty: true });
  }

  return (
    <DashCard>
      <h3 className="text-[15px] font-semibold text-ink mb-1">RRSP/Traditional IRA Meltdown</h3>
      <p className="text-[12.5px] text-dim mb-4">
        Deliberately withdraw beyond the spending need each year, up to a target taxable-income ceiling, to smooth income across low-tax years
        instead of one huge forced RRIF/RMD withdrawal later. The after-tax surplus is reinvested into a bucket you choose.
      </p>
      <div className="flex items-center gap-3 mb-4">
        <Switch
          checked={rule.enabled}
          onCheckedChange={(checked: boolean) => setValue('meltdownRule', { ...rule, enabled: checked }, { shouldDirty: true })}
        />
        <Label className="!mt-0">{rule.enabled ? 'Enabled' : 'Disabled'}</Label>
      </div>

      {rule.enabled && (
        <div className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label>Source accounts (tax-deferred only)</Label>
            {taxDeferredBuckets.length === 0 && <p className="text-[13px] text-dim">No tax-deferred accounts in this scenario.</p>}
            <div className="flex flex-col gap-1.5">
              {taxDeferredBuckets.map((bucket) => (
                <label key={bucket.id} className="flex items-center gap-2 text-[13px] text-ink cursor-pointer">
                  <Checkbox
                    checked={rule.sourceAccountBucketIds.includes(bucket.id)}
                    onCheckedChange={(checked: boolean) => toggleSource(bucket.id, checked)}
                  />
                  {bucket.label}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-[720px]">
            <div className="space-y-1.5">
              <Label>Target taxable income ceiling</Label>
              <MoneyInput
                value={rule.targetTaxableIncomeCeiling}
                onChange={(value) => setValue('meltdownRule', { ...rule, targetTaxableIncomeCeiling: value ?? 0 }, { shouldDirty: true })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Start year</Label>
              <Input
                type="number"
                placeholder="Not set"
                value={rule.startYear ?? ''}
                onChange={(e) => setValue('meltdownRule', { ...rule, startYear: e.target.value === '' ? null : Math.round(Number(e.target.value)) }, { shouldDirty: true })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>End year</Label>
              <Input
                type="number"
                placeholder="Not set"
                value={rule.endYear ?? ''}
                onChange={(e) => setValue('meltdownRule', { ...rule, endYear: e.target.value === '' ? null : Math.round(Number(e.target.value)) }, { shouldDirty: true })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Reinvest surplus into</Label>
              <Select
                value={rule.destinationAccountBucketId ?? ''}
                onValueChange={(v: string) => setValue('meltdownRule', { ...rule, destinationAccountBucketId: v }, { shouldDirty: true })}
              >
                <SelectTrigger className="cursor-pointer">
                  <SelectValue placeholder="Choose an account..." />
                </SelectTrigger>
                <SelectContent>
                  {buckets.map((bucket) => (
                    <SelectItem key={bucket.id} value={bucket.id}>
                      {bucket.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}
    </DashCard>
  );
}
