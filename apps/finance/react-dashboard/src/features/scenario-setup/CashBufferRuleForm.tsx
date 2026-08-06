import { Controller, useFormContext } from 'react-hook-form';
import { DashCard } from '../../components/DashCard';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { Switch } from '@repo/ui/components/switch';
import { ReplenishmentOrderEditor } from './ReplenishmentOrderEditor';
import type { Scenario } from '../../engine/schema';

export function CashBufferRuleForm({ personIndex }: { personIndex: number }) {
  const { register, control, watch } = useFormContext<Scenario>();
  const enabled = watch(`persons.${personIndex}.cashBufferRule.enabled`);
  const sharedRule = watch('sharedCashBufferRule');
  const sharedBuckets = watch('sharedAccountBuckets') ?? [];
  const sharedTarget = sharedBuckets.find((b) => b.id === sharedRule?.targetAccountBucketId);
  // A configured household buffer replaces the per-person ones entirely, so
  // nobody accidentally reserves the same months of spending twice.
  const supersededByShared = Boolean(sharedRule?.enabled && sharedTarget);

  return (
    <DashCard>
      <h3 className="text-[15px] font-semibold text-ink mb-1">Cash Buffer Rule</h3>
      <p className="text-[12.5px] text-dim mb-4">
        Maintain a cash pool covering a set number of months of this person's spending; auto-replenish from their invested assets when it drops below
        target.
      </p>

      {supersededByShared ? (
        <p className="text-[12.5px] text-dim rounded-[9px] bg-surface-muted px-3 py-2.5">
          The household cash buffer in <span className="text-ink font-medium">{sharedTarget!.label}</span> is active, so it replaces this per-person
          rule. Its top-up is funded from every person's accounts together, in the household withdrawal order - so the sequence below no longer
          applies, but unticking an account still keeps it out of the top-up entirely.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-4">
            <Controller
              control={control}
              name={`persons.${personIndex}.cashBufferRule.enabled`}
              render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
            />
            <Label className="!mt-0">{enabled ? 'Enabled' : 'Disabled'}</Label>
          </div>
          {enabled && (
            <div className="space-y-1.5 max-w-[220px] mb-4">
              <Label>Target months of spending</Label>
              <Input type="number" {...register(`persons.${personIndex}.cashBufferRule.targetMonthsOfSpending`, { valueAsNumber: true })} />
            </div>
          )}
        </>
      )}

      {(enabled || supersededByShared) && (
        <div className="mt-4 pt-4 border-t border-edge">
          <Label className="mb-2 block">Replenish from</Label>
          <ReplenishmentOrderEditor personIndex={personIndex} />
        </div>
      )}
    </DashCard>
  );
}
