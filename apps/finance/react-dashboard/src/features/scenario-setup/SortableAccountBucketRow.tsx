import { ArrowRightLeft, GripVertical, Trash2 } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { Badge } from '@repo/ui/components/badge';
import { Checkbox } from '@repo/ui/components/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@repo/ui/components/dropdown-menu';
import { MoneyInput } from '../../components/MoneyInput';
import { ACCOUNT_KIND_META, availableFromAgeFor } from '../../engine/accountKindMeta';
import { returnRatePctFor } from '../../engine/schema';
import { cn } from '../../lib/utils';
import type { AccountBucket, ReturnRates, TaxTreatment } from '../../engine/schema';

const TAX_TREATMENT_LABEL: Record<TaxTreatment, string> = {
  taxable: 'taxable',
  taxDeferred: 'tax-deferred',
  taxFree: 'tax-free',
};

interface SortableAccountBucketRowProps {
  bucket: AccountBucket;
  /** Scenario-level growth assumptions, shown per row so the rate this account earns isn't invisible here. */
  returnRates: ReturnRates;
  onUpdate: (patch: Partial<AccountBucket>) => void;
  onRemove: () => void;
  removeDisabled: boolean;
  /**
   * Every other person this bucket could move to. Omitted (or empty) hides the
   * move control entirely - SharedAccountsEditor reuses this row for jointly-held
   * accounts, which have no single owner to move "away from".
   */
  otherPersons?: { index: number; label: string }[];
  onMoveTo?: (targetPersonIndex: number) => void;
  /** True when this is the person's last account - moving it away would leave them with none. */
  moveDisabled?: boolean;
}

/**
 * One editable account row, draggable to reorder. Shared by the per-person
 * AccountBucketsEditor and the scenario-level SharedAccountsEditor.
 *
 * Fields here are plain controlled inputs reading straight from `bucket` and
 * writing back via `onUpdate` - deliberately NOT react-hook-form's
 * register()/Controller. These arrays are reordered via a plain setValue +
 * arrayMove (matching WaterfallOrderEditor's pattern), and RHF's Controller/
 * register instances don't reliably resync when their `name` (built from an
 * array index) changes under a mounted component - with shouldUnregister:
 * false (needed so tab-switching doesn't drop edits), a Controller remounted
 * at the same path even picks up the OLD occupant's stale cached value
 * instead of the new one, silently corrupting data on save. Plain controlled
 * inputs sidestep that registry entirely, the same way MeltdownRulesForm
 * already does for its per-account rows.
 */
export function SortableAccountBucketRow({
  bucket,
  returnRates,
  onUpdate,
  onRemove,
  removeDisabled,
  otherPersons = [],
  onMoveTo,
  moveDisabled,
}: SortableAccountBucketRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: bucket.id });

  const availableFrom = availableFromAgeFor(bucket);
  const preRetirementPct = returnRatePctFor(bucket, returnRates, false);
  const postRetirementPct = returnRatePctFor(bucket, returnRates, true);
  // Collapsed to one figure when both halves agree, which is the usual case
  // for cash - "2% growth" reads better than "2% then 2%".
  const growthNote =
    preRetirementPct === postRetirementPct
      ? `${preRetirementPct}% growth`
      : `${preRetirementPct}% growth, ${postRetirementPct}% after retirement`;
  // Naming the step matters: a TFSA limit sits flat for years and then jumps
  // 500, so a contribution that doesn't move every year still is indexed.
  const roundingStep = ACCOUNT_KIND_META[bucket.kind]?.contributionIndexRoundingStep ?? null;
  const indexingNote = roundingStep ? `contribution indexed, rounded to ${roundingStep}` : 'contribution indexed';
  // A cash account is excluded even though it's taxable: its whole return is
  // interest taxed as it's earned, so basis and balance never diverge.
  const tracksCostBasis = bucket.taxTreatment === 'taxable' && !bucket.isCashBuffer;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('flex items-start gap-2 border-b border-edge pb-4 last:border-0 last:pb-0', isDragging && 'opacity-50 relative z-10')}
    >
      <button
        type="button"
        className="mt-2.5 shrink-0 cursor-grab active:cursor-grabbing touch-none text-dim hover:text-ink"
        aria-label={`Drag to reorder ${bucket.label}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="flex-1 space-y-1.5">
        <div className={`grid grid-cols-2 gap-3 items-end ${tracksCostBasis ? 'sm:grid-cols-6' : 'sm:grid-cols-5'}`}>
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
            <Input value={bucket.label} onChange={(e) => onUpdate({ label: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Starting balance ({bucket.country === 'US' ? 'USD' : 'CAD'})</Label>
            <MoneyInput value={bucket.startingBalance} onChange={(value) => onUpdate({ startingBalance: value ?? 0 })} />
          </div>
          {/* Cost basis only means anything on a taxable account: a registered
              one is taxed on the whole withdrawal or not at all, so there is no
              gain to separate out. Blank means "no embedded gain". */}
          {tracksCostBasis && (
            <div className="space-y-1.5">
              <Label>Cost basis ({bucket.country === 'US' ? 'USD' : 'CAD'})</Label>
              <MoneyInput value={bucket.costBasis} onChange={(value) => onUpdate({ costBasis: value })} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Annual contribution</Label>
            <MoneyInput value={bucket.annualContributionWhileWorking} onChange={(value) => onUpdate({ annualContributionWhileWorking: value })} />
          </div>
          {/* Both contribution qualifiers stacked in one cell: two 16px rows
              still come in under the label-plus-input height of the cells
              beside them, so `items-end` keeps every input on one line. */}
          <div className="flex flex-col gap-1.5 text-[12px] text-slate">
            <label className="flex items-center gap-2 cursor-pointer w-fit">
              <Checkbox
                checked={bucket.contributeInRetirement ?? false}
                onCheckedChange={(checked: boolean) => onUpdate({ contributeInRetirement: checked })}
                aria-label={`Keep contributing to ${bucket.label} after retirement`}
              />
              Keep contributing after retirement
            </label>
            <label className="flex items-center gap-2 cursor-pointer w-fit">
              <Checkbox
                checked={bucket.indexContributionToInflation ?? false}
                onCheckedChange={(checked: boolean) => onUpdate({ indexContributionToInflation: checked })}
                aria-label={`Grow the ${bucket.label} contribution with inflation`}
              />
              Grow with inflation
            </label>
          </div>
          <div className="flex justify-end gap-1">
            {otherPersons.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="cursor-pointer text-dim hover:text-ink"
                    aria-label={`Move ${bucket.label} to another person`}
                    disabled={moveDisabled}
                  >
                    <ArrowRightLeft className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Move to</DropdownMenuLabel>
                  {otherPersons.map((person) => (
                    <DropdownMenuItem key={person.index} onSelect={() => onMoveTo?.(person.index)} className="cursor-pointer">
                      {person.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="cursor-pointer text-loss hover:text-loss"
              onClick={onRemove}
              aria-label={`Remove ${bucket.label}`}
              disabled={removeDisabled}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
        {/* What this account IS, now that none of it is editable here: the kind
            it was created as, the rate it inherits from the scenario, and the
            statutory age gate. Spelling it out per row is what stops the
            scenario-level rates from being invisible at the point of use. */}
        <p className="text-[11.5px] text-dim">
          {ACCOUNT_KIND_META[bucket.kind]?.label ?? bucket.kind} · {TAX_TREATMENT_LABEL[bucket.taxTreatment]} · {growthNote} ·{' '}
          {availableFrom === null ? 'available at any age' : `available from age ${availableFrom}`}
          {bucket.indexContributionToInflation && (bucket.annualContributionWhileWorking ?? 0) > 0 ? ` · ${indexingNote}` : ''}
        </p>
      </div>
    </div>
  );
}
