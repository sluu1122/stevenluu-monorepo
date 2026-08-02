import { Controller, useFormContext } from 'react-hook-form';
import { DashCard } from '../../components/DashCard';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { Switch } from '@repo/ui/components/switch';
import type { Scenario } from '../../engine/schema';

export function CashBufferRuleForm() {
  const { register, control, watch } = useFormContext<Scenario>();
  const enabled = watch('cashBufferRule.enabled');

  return (
    <DashCard>
      <h3 className="text-[15px] font-semibold text-ink mb-1">Cash Buffer Rule</h3>
      <p className="text-[12.5px] text-dim mb-4">
        Maintain a cash pool covering a set number of months of spending; auto-replenish from invested assets when it drops below target.
      </p>
      <div className="flex items-center gap-3 mb-4">
        <Controller control={control} name="cashBufferRule.enabled" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
        <Label className="!mt-0">{enabled ? 'Enabled' : 'Disabled'}</Label>
      </div>
      {enabled && (
        <div className="space-y-1.5 max-w-[220px]">
          <Label>Target months of spending</Label>
          <Input type="number" {...register('cashBufferRule.targetMonthsOfSpending', { valueAsNumber: true })} />
        </div>
      )}
    </DashCard>
  );
}
