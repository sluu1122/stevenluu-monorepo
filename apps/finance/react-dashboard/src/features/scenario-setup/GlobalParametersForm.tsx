import { Controller, useFormContext } from 'react-hook-form';
import { DashCard } from '../../components/DashCard';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { Checkbox } from '@repo/ui/components/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/select';
import { getDefaultFederalTable } from '../../engine/taxBrackets';
import type { Country, Scenario } from '../../engine/schema';

export function GlobalParametersForm() {
  const { register, control, getValues, setValue } = useFormContext<Scenario>();

  // Tax residency drives which federal bracket table applies - switching it
  // regenerates the default table for the new country so the brackets shown
  // in Tax Assumptions always match the residency label above them.
  function handleTaxResidencyChange(nextCountry: Country) {
    const filingStatus = getValues('taxConfig.filingStatus');
    setValue('taxConfig.country', nextCountry, { shouldDirty: true });
    setValue('taxConfig.federalTable', getDefaultFederalTable(nextCountry, filingStatus), { shouldDirty: true });
  }

  return (
    <DashCard>
      <h3 className="text-[15px] font-semibold text-ink mb-1">Global Parameters</h3>
      <p className="text-[12.5px] text-dim mb-4">Assumptions shared by everyone in this scenario. Each person's own money lives on their tab.</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label>Scenario name</Label>
          <Input {...register('name')} />
        </div>
        <div className="space-y-1.5">
          <Label>Tax residency</Label>
          <Controller
            control={control}
            name="country"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(value: Country) => {
                  field.onChange(value);
                  handleTaxResidencyChange(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="CA">Canada</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Currency</Label>
          <Controller
            control={control}
            name="currency"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="CAD">CAD</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Exchange rate (USD → CAD)</Label>
          <Input type="number" step="0.01" {...register('exchangeRateUsdToCad', { valueAsNumber: true })} />
        </div>
      </div>

      {/* One pair of rates for everything invested and another for everything
          in cash, rather than a pair per account. Each account's row in
          Account Buckets restates the rate it lands on, so moving these up
          here doesn't make them invisible at the point of use. */}
      <h4 className="text-[13px] font-semibold text-ink mt-5 mb-1">Growth Assumptions</h4>
      <p className="text-[12.5px] text-dim mb-3">
        Applied to every account in the scenario. Cash accounts are kept separate because a savings balance tracks short rates rather than the market.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="space-y-1.5">
          <Label>Investments before retirement %</Label>
          <Input type="number" step="0.1" {...register('returnRates.investmentsPreRetirementPct', { valueAsNumber: true })} />
        </div>
        <div className="space-y-1.5">
          <Label>Investments after retirement %</Label>
          <Input type="number" step="0.1" {...register('returnRates.investmentsPostRetirementPct', { valueAsNumber: true })} />
        </div>
        <div className="space-y-1.5">
          <Label>Cash before retirement %</Label>
          <Input type="number" step="0.1" {...register('returnRates.cashPreRetirementPct', { valueAsNumber: true })} />
        </div>
        <div className="space-y-1.5">
          <Label>Cash after retirement %</Label>
          <Input type="number" step="0.1" {...register('returnRates.cashPostRetirementPct', { valueAsNumber: true })} />
        </div>
      </div>

      <Controller
        control={control}
        name="indexTaxThresholdsToInflation"
        render={({ field }) => (
          <label className="flex items-start gap-2.5 mt-5 cursor-pointer w-fit">
            <Checkbox checked={field.value} onCheckedChange={(checked: boolean) => field.onChange(checked)} className="mt-0.5" />
            <span className="text-[12.5px]">
              <span className="font-medium text-ink">Index tax brackets and thresholds to inflation</span>
              <span className="block text-dim">
                Raises bracket edges, the standard deduction/BPA, and the OAS clawback threshold each year, as the CRA and IRS both do. Turn it off to
                stress-test a bracket freeze — over a long projection that alone drags every withdrawal into the top bracket.
              </span>
            </span>
          </label>
        )}
      />
    </DashCard>
  );
}
