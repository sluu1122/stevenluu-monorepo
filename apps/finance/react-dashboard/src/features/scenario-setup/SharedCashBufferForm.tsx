import { useFormContext } from 'react-hook-form';
import { DashCard } from '../../components/DashCard';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { Switch } from '@repo/ui/components/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/select';
import { DEFAULT_SHARED_CASH_BUFFER_RULE } from '../../engine/schema';
import type { Scenario, SharedCashBufferRule } from '../../engine/schema';

export function SharedCashBufferForm() {
  const { watch, setValue } = useFormContext<Scenario>();
  const rule = watch('sharedCashBufferRule') ?? DEFAULT_SHARED_CASH_BUFFER_RULE;
  const sharedBuckets = watch('sharedAccountBuckets') ?? [];
  const cashCandidates = sharedBuckets.filter((b) => b.isCashBuffer);

  function update(patch: Partial<SharedCashBufferRule>) {
    setValue('sharedCashBufferRule', { ...rule, ...patch }, { shouldDirty: true });
  }

  return (
    <DashCard>
      <h3 className="text-[15px] font-semibold text-ink mb-1">Household Cash Buffer</h3>
      <p className="text-[12.5px] text-dim mb-4">
        One cash reserve for the whole household. The target is measured against everyone's combined spending, and counted against the cash in{' '}
        <span className="text-ink">every</span> cash account - shared or personal - not just the one below, so a top-up only runs when the household is
        genuinely short. Any shortfall is funded from each person's non-cash accounts in proportion to their share of that spending, and lands in the
        account chosen here. While this is on it replaces the per-person cash buffer rules.
      </p>

      {cashCandidates.length === 0 ? (
        <p className="text-[13px] text-dim">Add a shared Cash Pool or Cash / HYSA account above to hold a household buffer.</p>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-4">
            <Switch checked={rule.enabled} onCheckedChange={(checked: boolean) => update({ enabled: checked })} />
            <Label className="!mt-0">{rule.enabled ? 'Enabled' : 'Disabled'}</Label>
          </div>

          {rule.enabled && (
            <div className="grid grid-cols-2 gap-4 max-w-[520px]">
              <div className="space-y-1.5">
                <Label>Top-ups land in</Label>
                <Select value={rule.targetAccountBucketId ?? ''} onValueChange={(v: string) => update({ targetAccountBucketId: v })}>
                  <SelectTrigger className="cursor-pointer">
                    <SelectValue placeholder="Choose a shared cash account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {cashCandidates.map((bucket) => (
                      <SelectItem key={bucket.id} value={bucket.id}>
                        {bucket.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Target months of total spending</Label>
                <Input
                  type="number"
                  value={rule.targetMonthsOfSpending}
                  onChange={(e) => update({ targetMonthsOfSpending: e.target.value === '' ? 0 : Number(e.target.value) })}
                />
              </div>
            </div>
          )}
        </>
      )}
    </DashCard>
  );
}
