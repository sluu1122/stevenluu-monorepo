import { useFormContext } from 'react-hook-form';
import { GripVertical } from 'lucide-react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@repo/ui/components/badge';
import { Checkbox } from '@repo/ui/components/checkbox';
import { availableFromAgeFor } from '../../engine/accountKindMeta';
import { cn } from '../../lib/utils';
import type { AccountBucket, Scenario } from '../../engine/schema';

interface SortableSourceProps {
  bucket: AccountBucket;
  index: number;
  included: boolean;
  isShared: boolean;
  onToggle: (included: boolean) => void;
}

function SortableSource({ bucket, index, included, isShared, onToggle }: SortableSourceProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: bucket.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('flex flex-wrap items-center gap-2 px-3 py-2 rounded-[9px] bg-surface-muted text-[13px] text-ink', isDragging && 'opacity-50 relative z-10')}
    >
      <button
        type="button"
        className="p-2.5 -m-1.5 cursor-grab active:cursor-grabbing touch-none text-dim hover:text-ink"
        aria-label={`Drag to reorder ${bucket.label} in the replenishment order`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <Checkbox checked={included} onCheckedChange={(checked: boolean) => onToggle(checked)} aria-label={`Use ${bucket.label} to replenish cash`} />
      <span className={cn('min-w-0', !included && 'text-dim line-through')}>
        {included ? `${index + 1}. ` : ''}
        {bucket.label}
      </span>
      {isShared && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          Shared
        </Badge>
      )}
      {bucket.taxTreatment === 'taxDeferred' && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          Taxable on withdrawal
        </Badge>
      )}
      {availableFromAgeFor(bucket) !== null && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          From age {availableFromAgeFor(bucket)}
        </Badge>
      )}
    </li>
  );
}

/**
 * Which accounts back this person's cash buffer, and in what order they're
 * drawn on. Included accounts sort first (in their chosen order), excluded
 * ones fall to the bottom so they're still visible and easy to re-enable.
 */
export function ReplenishmentOrderEditor({ personIndex }: { personIndex: number }) {
  const { watch, setValue } = useFormContext<Scenario>();
  const ownBuckets = watch(`persons.${personIndex}.accountBuckets`) ?? [];
  const sharedBuckets = watch('sharedAccountBuckets') ?? [];
  const order = watch(`persons.${personIndex}.cashBufferRule.replenishmentOrder`) ?? [];

  const allBuckets = [...ownBuckets, ...sharedBuckets];
  const sharedIds = new Set(sharedBuckets.map((b) => b.id));

  const included = order.map((id) => allBuckets.find((b) => b.id === id)).filter((b): b is AccountBucket => b !== undefined);
  const excluded = allBuckets.filter((b) => !order.includes(b.id));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = included.findIndex((b) => b.id === active.id);
    const newIndex = included.findIndex((b) => b.id === over.id);
    // Only the included list is orderable - dragging an excluded row is a no-op.
    if (oldIndex === -1 || newIndex === -1) return;
    setValue(
      `persons.${personIndex}.cashBufferRule.replenishmentOrder`,
      arrayMove(included, oldIndex, newIndex).map((b) => b.id),
      { shouldDirty: true },
    );
  }

  function toggle(bucketId: string, include: boolean) {
    const next = include ? [...order, bucketId] : order.filter((id) => id !== bucketId);
    setValue(`persons.${personIndex}.cashBufferRule.replenishmentOrder`, next, { shouldDirty: true });
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[12.5px] text-dim">
        Accounts used to top the cash buffer back up, in order. Drawing from a tax-deferred account is a real distribution - the plan withdraws extra
        to cover the tax it triggers.
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={included.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <ol className="flex flex-col gap-1.5 max-w-[520px]">
            {included.map((bucket, index) => (
              <SortableSource
                key={bucket.id}
                bucket={bucket}
                index={index}
                included
                isShared={sharedIds.has(bucket.id)}
                onToggle={(checked) => toggle(bucket.id, checked)}
              />
            ))}
            {excluded.map((bucket) => (
              <SortableSource
                key={bucket.id}
                bucket={bucket}
                index={-1}
                included={false}
                isShared={sharedIds.has(bucket.id)}
                onToggle={(checked) => toggle(bucket.id, checked)}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </div>
  );
}
