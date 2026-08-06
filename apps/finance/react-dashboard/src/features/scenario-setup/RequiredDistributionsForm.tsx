import { useFormContext } from 'react-hook-form';
import { DashCard } from '../../components/DashCard';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { Switch } from '@repo/ui/components/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/select';
import { DEFAULT_REQUIRED_DISTRIBUTION_RULE } from '../../engine/schema';
import { statutoryDistributionStartAge } from '../../engine/requiredDistributions';
import type { RequiredDistributionRule, Scenario } from '../../engine/schema';

export function RequiredDistributionsForm({ personIndex }: { personIndex: number }) {
  const { watch, setValue } = useFormContext<Scenario>();
  const buckets = watch(`persons.${personIndex}.accountBuckets`) ?? [];
  const sharedBuckets = watch('sharedAccountBuckets') ?? [];
  const birthYear = watch(`persons.${personIndex}.birthYear`);
  const rule = watch(`persons.${personIndex}.requiredDistributionRule`) ?? DEFAULT_REQUIRED_DISTRIBUTION_RULE;

  const taxDeferredBuckets = buckets.filter((b) => b.taxTreatment === 'taxDeferred');
  const destinationChoices = [...buckets, ...sharedBuckets];

  function update(patch: Partial<RequiredDistributionRule>) {
    setValue(`persons.${personIndex}.requiredDistributionRule`, { ...rule, ...patch }, { shouldDirty: true });
  }

  // The law sets a different age per account country, so show each distinct
  // one rather than implying a single number covers a mixed portfolio.
  const statutoryAges = [...new Set(taxDeferredBuckets.map((b) => statutoryDistributionStartAge(b.country, birthYear)))].sort((a, b) => a - b);

  return (
    <DashCard>
      <h3 className="text-[15px] font-semibold text-ink mb-1">Required Minimum Distributions</h3>
      <p className="text-[12.5px] text-dim mb-4">
        Once you reach the qualifying age, a government-set share of each tax-deferred account's <span className="text-ink">prior year-end</span> balance
        must be withdrawn and taxed as income, whether the plan needs the money or not. US accounts follow the IRS Uniform Lifetime Table; Canadian
        RRIF/RRSP accounts follow the prescribed RRIF factors. The proceeds top up the cash buffer first - the money is leaving regardless, so covering
        a cash need with it beats selling something else - and the remainder is reinvested.
      </p>

      {taxDeferredBuckets.length === 0 ? (
        <p className="text-[13px] text-dim">No tax-deferred accounts for this person, so nothing is ever forced out.</p>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-4">
            <Switch checked={rule.enabled} onCheckedChange={(checked: boolean) => update({ enabled: checked })} />
            <Label className="!mt-0">{rule.enabled ? 'Modelling required distributions' : 'Off'}</Label>
          </div>

          {rule.enabled && (
            <div className="grid grid-cols-2 gap-4 max-w-[520px]">
              <div className="space-y-1.5">
                <Label>Start age</Label>
                <Input
                  type="number"
                  placeholder={statutoryAges.length > 0 ? `${statutoryAges.join(' / ')} (statutory)` : 'Statutory'}
                  value={rule.startAgeOverride ?? ''}
                  onChange={(e) => update({ startAgeOverride: e.target.value === '' ? null : Math.round(Number(e.target.value)) })}
                />
                <p className="text-[11.5px] text-dim">
                  Leave blank to use the age the law sets{statutoryAges.length > 0 ? ` for this person (${statutoryAges.join(' / ')})` : ''}.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Reinvest the excess into</Label>
                <Select value={rule.destinationAccountBucketId ?? ''} onValueChange={(v: string) => update({ destinationAccountBucketId: v })}>
                  <SelectTrigger className="cursor-pointer">
                    <SelectValue placeholder="Cash buffer (default)" />
                  </SelectTrigger>
                  <SelectContent>
                    {destinationChoices.map((destination) => (
                      <SelectItem key={destination.id} value={destination.id}>
                        {destination.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11.5px] text-dim">Only what the cash buffer doesn't need lands here.</p>
              </div>
            </div>
          )}
        </>
      )}
    </DashCard>
  );
}
