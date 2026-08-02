import { Controller, useFormContext } from 'react-hook-form';
import { DashCard } from '../../components/DashCard';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { MoneyInput } from '../../components/MoneyInput';
import type { Scenario } from '../../engine/schema';

export function GlobalParametersForm() {
  const { register, control, watch } = useFormContext<Scenario>();
  const country = watch('country');
  const currency = watch('currency');

  return (
    <DashCard>
      <h3 className="text-[15px] font-semibold text-ink mb-4">Global Parameters</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="space-y-1.5">
          <Label>Annual spending at retirement (real $)</Label>
          <Controller
            control={control}
            name="annualSpendingRealAtRetirement"
            render={({ field }) => <MoneyInput value={field.value} onChange={field.onChange} />}
          />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Scenario name</Label>
          <Input {...register('name')} />
        </div>
        <div className="space-y-1.5">
          <Label>Tax residency</Label>
          <Input value={country} disabled />
        </div>
        <div className="space-y-1.5">
          <Label>Currency</Label>
          <Input value={currency} disabled />
        </div>
        <div className="space-y-1.5">
          <Label>Exchange rate (USD → CAD)</Label>
          <Input type="number" step="0.01" {...register('exchangeRateUsdToCad', { valueAsNumber: true })} />
        </div>
      </div>
    </DashCard>
  );
}
