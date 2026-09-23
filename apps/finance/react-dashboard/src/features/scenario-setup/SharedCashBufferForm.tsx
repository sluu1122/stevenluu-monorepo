import { useFormContext } from 'react-hook-form';
import { DashCard } from '../../components/DashCard';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { Switch } from '@repo/ui/components/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/select';
import { DEFAULT_SHARED_CASH_BUFFER_RULE } from '../../engine/schema';
import { formatCurrency } from '../../lib/format';
import type { Scenario, SharedCashBufferRule } from '../../engine/schema';

export function SharedCashBufferForm() {
  const { watch, setValue } = useFormContext<Scenario>();
  const rule = watch('sharedCashBufferRule') ?? DEFAULT_SHARED_CASH_BUFFER_RULE;
  const sharedBuckets = watch('sharedAccountBuckets') ?? [];
  const cashCandidates = sharedBuckets.filter((b) => b.isCashBuffer);

  // What "N months of spending" actually comes to. The rule is stated in months
  // against a budget entered on another card, so the figure it resolves to -
  // the one worth comparing against the balances above - was never shown
  // anywhere. Quoted in today's dollars, the basis the spending fields
  // themselves use; the engine inflates the target each year alongside the
  // budget it tracks.
  const currency = watch('currency') ?? 'USD';
  const spendingBefore = watch('householdSpendingRealBeforeRetirement') ?? 0;
  const spendingAtRetirement = watch('householdSpendingRealAtRetirement') ?? 0;
  const persons = watch('persons') ?? [];
  // Mirrors Household Spending: with no retirement year set anywhere, the
  // before-retirement budget applies for the whole projection, so naming the
  // at-retirement figure would describe a phase that never arrives.
  const anyoneRetires = persons.some((p) => p.retirementStartYear !== null && p.retirementStartYear !== undefined);

  const months = rule.targetMonthsOfSpending;
  const targetFor = (annualSpending: number) => formatCurrency((months / 12) * annualSpending, currency);
  const showsTwoPhases = anyoneRetires && spendingAtRetirement !== spendingBefore;

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
        <p className="text-[13px] text-dim">Add a shared Cash and Cash Equivalents account (US or CA) above to hold a household buffer.</p>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-4">
            <Switch checked={rule.enabled} onCheckedChange={(checked: boolean) => update({ enabled: checked })} />
            <Label className="!mt-0">{rule.enabled ? 'Enabled' : 'Disabled'}</Label>
          </div>

          {rule.enabled && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-[520px]">
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

              <p className="text-[11.5px] text-dim mt-2 max-w-[520px]">
                {months <= 0 ? (
                  'A target of zero months keeps no buffer, so a top-up never runs.'
                ) : showsTwoPhases ? (
                  <>
                    {/* Deliberately not "rising to": a household that spends
                        LESS in retirement sees this figure fall, and two of the
                        demos do exactly that. */}
                    {months} months of the household's {formatCurrency(spendingBefore, currency)} budget is{' '}
                    <span className="text-ink">{targetFor(spendingBefore)}</span> while working, and{' '}
                    <span className="text-ink">{targetFor(spendingAtRetirement)}</span> once the {formatCurrency(spendingAtRetirement, currency)}{' '}
                    at-retirement budget applies. Both in today's dollars - the target is inflated each year alongside the spending it tracks.
                  </>
                ) : (
                  <>
                    {months} months of the household's {formatCurrency(spendingBefore, currency)} budget is{' '}
                    <span className="text-ink">{targetFor(spendingBefore)}</span> in today's dollars. The target is inflated each year alongside the
                    spending it tracks.
                  </>
                )}
              </p>
            </>
          )}
        </>
      )}
    </DashCard>
  );
}
