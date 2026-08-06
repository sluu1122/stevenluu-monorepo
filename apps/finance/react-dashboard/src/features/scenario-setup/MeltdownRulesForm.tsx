import { useFormContext } from 'react-hook-form';
import { DashCard } from '../../components/DashCard';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { Switch } from '@repo/ui/components/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/select';
import { MoneyInput } from '../../components/MoneyInput';
import { createDefaultMeltdownRule } from '../../engine/schema';
import { getBucketNativeCurrency } from '../../engine/currency';
import type { MeltdownRule, Scenario } from '../../engine/schema';

export function MeltdownRulesForm({ personIndex }: { personIndex: number }) {
  const { watch, setValue } = useFormContext<Scenario>();
  const buckets = watch(`persons.${personIndex}.accountBuckets`);
  const rules = watch(`persons.${personIndex}.meltdownRules`) ?? [];
  const scenarioCurrency = watch('currency');
  const taxDeferredBuckets = buckets.filter((b) => b.taxTreatment === 'taxDeferred');

  // One row per tax-deferred account. A bucket with no rule yet shows its
  // defaults; the rule is only written into the form once something changes.
  function ruleFor(bucketId: string): MeltdownRule {
    return rules.find((r) => r.accountBucketId === bucketId) ?? createDefaultMeltdownRule(bucketId);
  }

  function updateRule(bucketId: string, patch: Partial<MeltdownRule>) {
    const existing = rules.find((r) => r.accountBucketId === bucketId);
    const next = existing
      ? rules.map((r) => (r.accountBucketId === bucketId ? { ...r, ...patch } : r))
      : [...rules, { ...createDefaultMeltdownRule(bucketId), ...patch }];
    setValue(`persons.${personIndex}.meltdownRules`, next, { shouldDirty: true });
  }

  return (
    <DashCard>
      <h3 className="text-[15px] font-semibold text-ink mb-1">Meltdown Tax-Deferred Retirement Accounts</h3>
      <p className="text-[12.5px] text-dim mb-4">
        Deliberately withdraw beyond the spending need each year, up to a target taxable-income ceiling, to smooth income across low-tax years instead
        of one huge forced RRIF/RMD withdrawal later. Each tax-deferred account melts down on its own schedule, and the ceiling is measured against
        this person's taxable income alone. Every dollar figure here - the ceiling included - is in the scenario's currency
        (<span className="text-ink font-medium">{scenarioCurrency}</span>), even for an account whose own balance is held in a different one: a
        US account inside a CAD scenario has its balance converted before it's compared against the ceiling. The after-tax surplus is reinvested
        into an account you choose - left unset, it follows wherever this person's other spare income goes. In a year the cash buffer also needs
        topping up, the top-up comes out of the account being melted down first (up to the ceiling), rather than selling other investments alongside it.
      </p>

      {taxDeferredBuckets.length === 0 && <p className="text-[13px] text-dim">No tax-deferred accounts for this person.</p>}

      <div className="flex flex-col gap-4">
        {taxDeferredBuckets.map((bucket) => {
          const rule = ruleFor(bucket.id);
          return (
            <div key={bucket.id} className="border-b border-edge pb-4 last:border-0 last:pb-0">
              <div className="flex items-center gap-3 mb-3">
                <Switch checked={rule.enabled} onCheckedChange={(checked: boolean) => updateRule(bucket.id, { enabled: checked })} />
                <Label className="!mt-0 font-semibold">{bucket.label}</Label>
                {getBucketNativeCurrency(bucket.country) !== scenarioCurrency && (
                  <span className="text-[11px] text-dim border border-edge rounded-full px-2 py-0.5">
                    Held in {getBucketNativeCurrency(bucket.country)}, converted to {scenarioCurrency} below
                  </span>
                )}
                <span className="text-[12px] text-dim">{rule.enabled ? 'Melting down' : 'Off'}</span>
              </div>

              {rule.enabled && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-[720px]">
                  <div className="space-y-1.5">
                    <Label>Max taxable income</Label>
                    <MoneyInput value={rule.targetTaxableIncomeCeiling} onChange={(value) => updateRule(bucket.id, { targetTaxableIncomeCeiling: value ?? 0 })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Start year</Label>
                    <Input
                      type="number"
                      placeholder="Not set"
                      value={rule.startYear ?? ''}
                      onChange={(e) => updateRule(bucket.id, { startYear: e.target.value === '' ? null : Math.round(Number(e.target.value)) })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>End year</Label>
                    <Input
                      type="number"
                      placeholder="Not set"
                      value={rule.endYear ?? ''}
                      onChange={(e) => updateRule(bucket.id, { endYear: e.target.value === '' ? null : Math.round(Number(e.target.value)) })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Reinvest surplus into</Label>
                    <Select value={rule.destinationAccountBucketId ?? ''} onValueChange={(v: string) => updateRule(bucket.id, { destinationAccountBucketId: v })}>
                      <SelectTrigger className="cursor-pointer">
                        <SelectValue placeholder="Cash buffer (default)" />
                      </SelectTrigger>
                      <SelectContent>
                        {buckets.map((destination) => (
                          <SelectItem key={destination.id} value={destination.id}>
                            {destination.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </DashCard>
  );
}
