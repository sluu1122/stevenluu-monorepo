import { Controller, useFormContext } from 'react-hook-form';
import { DashCard } from '../../components/DashCard';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { Switch } from '@repo/ui/components/switch';
import type { Scenario } from '../../engine/schema';

export function TaxableAccountTaxationForm() {
  const { register, control, watch } = useFormContext<Scenario>();
  const enabled = watch('taxableAccountTaxation.enabled');

  return (
    <DashCard>
      <h3 className="text-[15px] font-semibold text-ink mb-1">Non-Registered Account Tax</h3>
      <p className="text-[12.5px] text-dim mb-4">
        What a taxable account owes as it earns and as it is sold. Turned off, these accounts compound entirely tax-free, which flatters any plan
        that runs for decades.
      </p>

      <div className="flex items-center gap-3 mb-4">
        <Controller
          control={control}
          name="taxableAccountTaxation.enabled"
          render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
        />
        <Label className="!mt-0">{enabled ? 'Taxed' : 'Not taxed'}</Label>
      </div>

      {enabled && (
        <>
          <div className="grid grid-cols-2 gap-4 max-w-[420px]">
            <div className="space-y-1.5">
              <Label>Annual distribution yield %</Label>
              <Input type="number" step="0.1" {...register('taxableAccountTaxation.annualDistributionYieldPct', { valueAsNumber: true })} />
            </div>
            <div className="space-y-1.5">
              <Label>Capital gains inclusion %</Label>
              <Input type="number" step="1" {...register('taxableAccountTaxation.capitalGainsInclusionRatePct', { valueAsNumber: true })} />
            </div>
          </div>
          <p className="text-[12px] text-dim mt-3 leading-relaxed">
            The yield is the part of the return paid out each year as interest and dividends, taxed as ordinary income. Everything else is
            appreciation, taxed only when sold and only on the included portion of the gain. A cash account is treated as distributing its whole
            return, since all of it is interest. The dividend gross-up and dividend tax credit are not modelled, so eligible Canadian dividends come
            out slightly over-taxed.
          </p>
        </>
      )}
    </DashCard>
  );
}
