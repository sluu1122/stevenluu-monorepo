import { useFormContext } from 'react-hook-form';
import { GripVertical } from 'lucide-react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DashCard } from '../../components/DashCard';
import { Badge } from '@repo/ui/components/badge';
import { Checkbox } from '@repo/ui/components/checkbox';
import { ACCOUNT_KIND_META, US_ACCOUNT_KINDS, CA_ACCOUNT_KINDS } from '../../engine/accountKindMeta';
import { cn } from '../../lib/utils';
import type { AccountBucket, AccountKind, Scenario } from '../../engine/schema';

const ALL_KINDS: AccountKind[] = [...CA_ACCOUNT_KINDS, ...US_ACCOUNT_KINDS];

interface SortableKindProps {
  kind: AccountKind;
  index: number;
  included: boolean;
  accounts: { label: string; shared: boolean }[];
  onToggle: (include: boolean) => void;
}

function SortableKind({ kind, index, included, accounts, onToggle }: SortableKindProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: kind });
  const meta = ACCOUNT_KIND_META[kind];

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('flex items-start gap-2 px-3 py-2 rounded-[9px] bg-surface-muted', isDragging && 'opacity-50 relative z-10')}
    >
      <button
        type="button"
        className="mt-0.5 cursor-grab active:cursor-grabbing touch-none text-dim hover:text-ink"
        aria-label={`Drag to reorder ${meta.label} in the withdrawal order`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <Checkbox
        className="mt-0.5"
        checked={included}
        onCheckedChange={(checked: boolean) => onToggle(checked)}
        aria-label={`Draw ${meta.label} to fund spending`}
      />
      <div className="min-w-0 flex-1">
        <span className={cn('text-[13px] text-ink flex items-center gap-1.5 flex-wrap', !included && 'text-dim line-through')}>
          {included ? `${index + 1}. ` : ''}
          {meta.label}
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {meta.country}
          </Badge>
        </span>
        <p className="text-[11.5px] text-dim mt-0.5">
          {accounts.length === 0
            ? 'No accounts of this kind in the household'
            : accounts.map((a) => `${a.label}${a.shared ? ' (shared)' : ''}`).join(', ')}
        </p>
      </div>
    </li>
  );
}

/**
 * The order the household spends its accounts down, by KIND.
 *
 * By kind rather than by account so "spend taxable before tax-free" is said
 * once, holds for everyone, and keeps holding when an account is added. The
 * draw runs across every account in the household, so one partner's spending
 * can be funded from the other's accounts - which is what a household actually
 * does, and it also spreads withdrawals over two sets of tax brackets.
 *
 * Unticking a kind takes it off-limits to spending entirely. Cash-buffer
 * replenishment, meltdown rules and statutory minimums each have their own
 * settings and can still reach it.
 */
export function HouseholdWithdrawalOrderForm() {
  const { watch, setValue } = useFormContext<Scenario>();
  const order = watch('householdWithdrawalOrder') ?? [];
  const persons = watch('persons') ?? [];
  const sharedBuckets = watch('sharedAccountBuckets') ?? [];

  // The distance constraint is what stops a plain tap counting as a drag. On
  // touch, without it, tapping the handle silently reorders the withdrawal
  // order - which changes engine output. Matches the other sortable editors.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const accountsOf = (kind: AccountKind): { label: string; shared: boolean }[] => [
    ...sharedBuckets.filter((b: AccountBucket) => b.kind === kind).map((b: AccountBucket) => ({ label: b.label, shared: true })),
    ...persons.flatMap((p) => p.accountBuckets.filter((b) => b.kind === kind).map((b) => ({ label: b.label, shared: false }))),
  ];

  const included = order.filter((kind) => ALL_KINDS.includes(kind));
  const excluded = ALL_KINDS.filter((kind) => !included.includes(kind));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = included.indexOf(active.id as AccountKind);
    const newIndex = included.indexOf(over.id as AccountKind);
    // Only the included list is orderable - dragging an excluded row is a no-op.
    if (oldIndex === -1 || newIndex === -1) return;
    setValue('householdWithdrawalOrder', arrayMove(included, oldIndex, newIndex), { shouldDirty: true });
  }

  function toggle(kind: AccountKind, include: boolean) {
    setValue('householdWithdrawalOrder', include ? [...included, kind] : included.filter((k) => k !== kind), { shouldDirty: true });
  }

  return (
    <DashCard>
      <h3 className="text-[15px] font-semibold text-ink mb-1">Withdrawal Order</h3>
      <p className="text-[12.5px] text-dim mb-4">
        The order the household spends its accounts down, across everyone — one partner's spending can be funded from the other's accounts, which is
        what a household actually does and spreads the tax over two sets of brackets. Untick a kind to keep it off-limits to spending; replenishment,
        meltdowns and statutory minimums each have their own settings and can still reach it.
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={included} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-1.5">
            {included.map((kind, index) => (
              <SortableKind key={kind} kind={kind} index={index} included accounts={accountsOf(kind)} onToggle={(v) => toggle(kind, v)} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {excluded.length > 0 && (
        <>
          <h4 className="text-[12px] font-semibold uppercase tracking-[0.04em] text-slate mt-4 mb-2">Never drawn for spending</h4>
          <ul className="flex flex-col gap-1.5">
            {excluded.map((kind) => (
              <SortableKind key={kind} kind={kind} index={0} included={false} accounts={accountsOf(kind)} onToggle={(v) => toggle(kind, v)} />
            ))}
          </ul>
        </>
      )}
    </DashCard>
  );
}
