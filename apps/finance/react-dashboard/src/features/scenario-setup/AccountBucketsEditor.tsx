import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Plus } from 'lucide-react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { DashCard } from '../../components/DashCard';
import { Button } from '@repo/ui/components/button';
import { Label } from '@repo/ui/components/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@repo/ui/components/select';
import { ACCOUNT_KIND_META, CA_ACCOUNT_KINDS, US_ACCOUNT_KINDS, createBlankAccountBucket } from '../../engine/accountKindMeta';
import { SortableAccountBucketRow } from './SortableAccountBucketRow';
import type { AccountBucket, AccountKind, Scenario } from '../../engine/schema';

export function AccountBucketsEditor({ personIndex }: { personIndex: number }) {
  const { watch, setValue, getValues } = useFormContext<Scenario>();
  const buckets = watch(`persons.${personIndex}.accountBuckets`);
  const replenishmentOrder = watch(`persons.${personIndex}.cashBufferRule.replenishmentOrder`);
  const returnRates = watch('returnRates');
  const meltdownRules = watch(`persons.${personIndex}.meltdownRules`);
  const surplusDestinationId = watch(`persons.${personIndex}.surplusDestinationAccountBucketId`);
  const requiredDistributionRule = watch(`persons.${personIndex}.requiredDistributionRule`);
  const allPersons = watch('persons');
  const otherPersons = allPersons.map((p, index) => ({ index, label: p.label || 'Unnamed' })).filter((p) => p.index !== personIndex);
  const [kindToAdd, setKindToAdd] = useState<AccountKind | ''>('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function updateBucket(bucketId: string, patch: Partial<AccountBucket>) {
    setValue(
      `persons.${personIndex}.accountBuckets`,
      buckets.map((b) => (b.id === bucketId ? { ...b, ...patch } : b)),
      { shouldDirty: true },
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = buckets.findIndex((b) => b.id === active.id);
    const newIndex = buckets.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    setValue(`persons.${personIndex}.accountBuckets`, arrayMove(buckets, oldIndex, newIndex), { shouldDirty: true });
  }

  function addAccount() {
    if (!kindToAdd) return;
    const bucket = createBlankAccountBucket(kindToAdd);
    setValue(`persons.${personIndex}.accountBuckets`, [...buckets, bucket], { shouldDirty: true });
    if (!bucket.isCashBuffer) {
      setValue(`persons.${personIndex}.cashBufferRule.replenishmentOrder`, [...replenishmentOrder, bucket.id], { shouldDirty: true });
    }
    setKindToAdd('');
  }

  function removeAccount(bucketId: string) {
    setValue(
      `persons.${personIndex}.accountBuckets`,
      buckets.filter((b) => b.id !== bucketId),
      { shouldDirty: true },
    );
    setValue(
      `persons.${personIndex}.cashBufferRule.replenishmentOrder`,
      replenishmentOrder.filter((id) => id !== bucketId),
      { shouldDirty: true },
    );
    // Drop any meltdown rule that pointed at this account, and clear it as a
    // reinvestment destination, so no rule is left referencing a dead bucket.
    setValue(
      `persons.${personIndex}.meltdownRules`,
      meltdownRules
        .filter((r) => r.accountBucketId !== bucketId)
        .map((r) => (r.destinationAccountBucketId === bucketId ? { ...r, destinationAccountBucketId: null } : r)),
      { shouldDirty: true },
    );
    if (surplusDestinationId === bucketId) {
      setValue(`persons.${personIndex}.surplusDestinationAccountBucketId`, null, { shouldDirty: true });
    }
    if (requiredDistributionRule?.destinationAccountBucketId === bucketId) {
      setValue(`persons.${personIndex}.requiredDistributionRule`, { ...requiredDistributionRule, destinationAccountBucketId: null }, { shouldDirty: true });
    }
  }

  /**
   * Moves a bucket to another person's own account list, preserving its
   * balance and settings. Every per-person rule that can name a bucket by id
   * (replenishment order, meltdown rules, surplus/RMD destinations) is scoped
   * to whichever person holds it, so the same cleanup removeAccount does has
   * to run here too - the difference is the bucket itself is re-appended on
   * the target person rather than discarded, exactly like a fresh addAccount
   * there. The drawdown order needs no cascade: it's by KIND, household-wide.
   */
  function moveAccountToPerson(bucketId: string, targetPersonIndex: number) {
    const bucket = buckets.find((b) => b.id === bucketId);
    if (!bucket) return;

    setValue(
      `persons.${personIndex}.accountBuckets`,
      buckets.filter((b) => b.id !== bucketId),
      { shouldDirty: true },
    );
    setValue(
      `persons.${personIndex}.cashBufferRule.replenishmentOrder`,
      replenishmentOrder.filter((id) => id !== bucketId),
      { shouldDirty: true },
    );
    setValue(
      `persons.${personIndex}.meltdownRules`,
      meltdownRules
        .filter((r) => r.accountBucketId !== bucketId)
        .map((r) => (r.destinationAccountBucketId === bucketId ? { ...r, destinationAccountBucketId: null } : r)),
      { shouldDirty: true },
    );
    if (surplusDestinationId === bucketId) {
      setValue(`persons.${personIndex}.surplusDestinationAccountBucketId`, null, { shouldDirty: true });
    }
    if (requiredDistributionRule?.destinationAccountBucketId === bucketId) {
      setValue(`persons.${personIndex}.requiredDistributionRule`, { ...requiredDistributionRule, destinationAccountBucketId: null }, { shouldDirty: true });
    }

    const targetBuckets = getValues(`persons.${targetPersonIndex}.accountBuckets`);
    const targetReplenishmentOrder = getValues(`persons.${targetPersonIndex}.cashBufferRule.replenishmentOrder`);
    setValue(`persons.${targetPersonIndex}.accountBuckets`, [...targetBuckets, bucket], { shouldDirty: true });
    if (!bucket.isCashBuffer) {
      setValue(`persons.${targetPersonIndex}.cashBufferRule.replenishmentOrder`, [...targetReplenishmentOrder, bucket.id], { shouldDirty: true });
    }
  }

  return (
    <DashCard>
      <h3 className="text-[15px] font-semibold text-ink mb-1">Account Buckets</h3>
      <p className="text-[12.5px] text-dim mb-4">
        Accounts belonging to this person only - jointly-held money lives in Shared Accounts on the Household tab. Mix US and Canadian account kinds
        freely for dual-citizen or cross-border scenarios. The order these are spent down is set once for the household in Withdrawal Order; if more
        than one account is flagged "Cash buffer," only the first receives income surplus and replenishment.
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={buckets.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-4">
            {buckets.map((bucket) => (
              <SortableAccountBucketRow
                key={bucket.id}
                bucket={bucket}
                returnRates={returnRates}
                onUpdate={(patch) => updateBucket(bucket.id, patch)}
                onRemove={() => removeAccount(bucket.id)}
                removeDisabled={buckets.length <= 1}
                otherPersons={otherPersons}
                onMoveTo={(targetPersonIndex) => moveAccountToPerson(bucket.id, targetPersonIndex)}
                moveDisabled={buckets.length <= 1}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex items-end gap-2 mt-4 pt-4 border-t border-edge">
        <div className="space-y-1.5 flex-1 max-w-[280px] h-16">
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
