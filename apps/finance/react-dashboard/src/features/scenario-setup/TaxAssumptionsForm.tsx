import { Controller, useFormContext } from 'react-hook-form';
import { DashCard } from '../../components/DashCard';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/select';
import type { Scenario } from '../../engine/schema';

export function TaxAssumptionsForm() {
  const { register, control, watch } = useFormContext<Scenario>();
  const country = watch('country');
  const brackets = watch('taxConfig.federalTable.brackets');

  return (
    <DashCard>
      <h3 className="text-[15px] font-semibold text-ink mb-1">Tax Assumptions</h3>
      <p className="text-[12.5px] text-dim mb-4">
        Federal brackets seeded from {country === 'US' ? 'Tax Foundation' : 'CRA'} 2026 figures - rates are editable.
        {country === 'US' ? ' State' : ' Provincial'} tax is a single flat rate, not a full bracket table.
      </p>
      <div className="grid grid-cols-2 gap-4 mb-5 max-w-[420px]">
        {country === 'US' && (
          <div className="space-y-1.5">
            <Label>Filing status</Label>
            <Controller
              control={control}
              name="taxConfig.filingStatus"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single</SelectItem>
                    <SelectItem value="marriedFilingJointly">Married Filing Jointly</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label>{country === 'US' ? 'State' : 'Provincial'} flat rate %</Label>
          <Input type="number" step="0.1" {...register('taxConfig.stateOrProvincialFlatRatePct', { valueAsNumber: true })} />
        </div>
      </div>

      <Label className="mb-2 block">Federal brackets</Label>
      <div className="flex flex-col gap-2 max-w-[360px]">
        {brackets.map((bracket, index) => (
          <div key={index} className="grid grid-cols-[1fr_auto] gap-3 items-center text-[13px]">
            <span className="text-dim font-mono">
              ${bracket.min.toLocaleString()} – {bracket.max === null ? 'and up' : `$${bracket.max.toLocaleString()}`}
            </span>
            <Controller
              control={control}
              name={`taxConfig.federalTable.brackets.${index}.rate`}
              render={({ field }) => (
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    step="0.1"
                    className="w-[80px]"
                    value={(field.value * 100).toFixed(2)}
                    onChange={(e) => field.onChange(Number(e.target.value) / 100)}
                  />
                  <span className="text-dim">%</span>
                </div>
              )}
            />
          </div>
        ))}
      </div>
    </DashCard>
  );
}
