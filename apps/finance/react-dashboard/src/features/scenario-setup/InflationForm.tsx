import { useFormContext } from 'react-hook-form';
import { DashCard } from '../../components/DashCard';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import type { Scenario } from '../../engine/schema';

export function InflationForm() {
  const { register } = useFormContext<Scenario>();

  return (
    <DashCard>
      <h3 className="text-[15px] font-semibold text-ink mb-1">Inflation</h3>
      <p className="text-[12.5px] text-dim mb-4">A flat annual rate compounds every person's nominal spending forward each year in retirement.</p>
      <div className="space-y-1.5 max-w-[220px]">
        <Label>Flat annual rate %</Label>
        <Input type="number" step="0.1" {...register('inflation.flatRatePct', { valueAsNumber: true })} />
      </div>
    </DashCard>
  );
}
