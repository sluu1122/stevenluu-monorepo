import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Plus } from 'lucide-react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { DashCard } from '../../components/DashCard';
import { Button } from '@repo/ui/components/button';
import { Label } from '@repo/ui/components/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/select';
import { ACCOUNT_KIND_META, createBlankAccountBucket } from '../../engine/accountKindMeta';
import { SHARED_ACCOUNT_KINDS } from '../../engine/schema';
import { SortableAccountBucketRow } from './SortableAccountBucketRow';
import type { AccountBucket, AccountKind, Scenario } from '../../engine/schema';

export function SharedAccountsEditor() {
  const { watch, setValue } = useFormContext<Scenario>();
  const shared = watch('sharedAccountBuckets') ?? [];
  const persons = watch('persons') ?? [];
  const returnRates = watch('returnRates');
  const [kindToAdd, setKindToAdd] = useState<AccountKind | ''>('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function updateBucket(bucketId: string, patch: Partial<AccountBucket>) {
    setValue(
      'sharedAccountBuckets',
      shared.map((b) => (b.id === bucketId ? { ...b, ...patch } : b)),
      { shouldDirty: true },
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = shared.findIndex((b) => b.id === active.id);
    const newIndex = shared.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    setValue('sharedAccountBuckets', arrayMove(shared, oldIndex, newIndex), { shouldDirty: true });
  }

  // Spending reaches a shared account through the household's Withdrawal
  // Order, which is by KIND, so adding one needs no drawdown bookkeeping.
  // Replenishment sources are still per-person, though, so those (and any
  // surplus destination pointing at a removed account) still cascade.
  function addAccount() {
    if (!kindToAdd) return;
    const bucket = createBlankAccountBucket(kindToAdd);
    setValue('sharedAccountBuckets', [...shared, bucket], { shouldDirty: true });
    persons.forEach((person, i) => {
      if (!bucket.isCashBuffer) {
        setValue(`persons.${i}.cashBufferRule.replenishmentOrder`, [...person.cashBufferRule.replenishmentOrder, bucket.id], { shouldDirty: true });
      }
    });
    setKindToAdd('');
  }

  function removeAccount(bucketId: string) {
    setValue(
      'sharedAccountBuckets',
      shared.filter((b) => b.id !== bucketId),
      { shouldDirty: true },
    );
    persons.forEach((person, i) => {
      setValue(
        `persons.${i}.cashBufferRule.replenishmentOrder`,
        person.cashBufferRule.replenishmentOrder.filter((id) => id !== bucketId),
        { shouldDirty: true },
      );
      if (person.surplusDestinationAccountBucketId === bucketId) {
        setValue(`persons.${i}.surplusDestinationAccountBucketId`, null, { shouldDirty: true });
      }
    });
  }

  return (
    <DashCard>
      <h3 className="text-[15px] font-semibold text-ink mb-1">Shared Accounts</h3>
      <p className="text-[12.5px] text-dim mb-4">
        Jointly-held accounts any person can pay into and draw from. Where they sit in the drawdown is set once for the household in Withdrawal
        Order above. Only non-registered and cash accounts can be joint; RRSPs, TFSAs, 401(k)s and IRAs are individual by law and stay on a person's
        own tab.
      </p>

      {shared.length === 0 && <p className="text-[13px] text-dim">No shared accounts. Add one below to pool money across persons.</p>}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={shared.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-4">
            {shared.map((bucket) => (
              <SortableAccountBucketRow
                key={bucket.id}
                bucket={bucket}
                returnRates={returnRates}
                onUpdate={(patch) => updateBucket(bucket.id, patch)}
                onRemove={() => removeAccount(bucket.id)}
                removeDisabled={false}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex items-end gap-2 mt-4 pt-4 border-t border-edge">
        <div className="space-y-1.5 flex-1 max-w-[280px] h-16">
          <Label>Add shared account</Label>
          <Select value={kindToAdd} onValueChange={(v: string) => setKindToAdd(v as AccountKind)}>
            <SelectTrigger className="cursor-pointer">
              <SelectValue placeholder="Choose an account kind..." />
            </SelectTrigger>
            <SelectContent>
              {SHARED_ACCOUNT_KINDS.map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {ACCOUNT_KIND_META[kind].label} ({ACCOUNT_KIND_META[kind].country})
                </SelectItem>
              ))}
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
