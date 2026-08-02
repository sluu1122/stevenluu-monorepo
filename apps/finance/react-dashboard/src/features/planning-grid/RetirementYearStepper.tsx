import { Minus, Plus } from 'lucide-react';
import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';

interface RetirementYearStepperProps {
  label: string;
  value: number | null;
  birthYear: number;
  onChange: (value: number | null) => void;
}

/** A labeled +/- year control - replaces the grid's old per-row "Retire" radio with one control per person. */
export function RetirementYearStepper({ label, value, birthYear, onChange }: RetirementYearStepperProps) {
  function step(delta: number) {
    const base = value ?? Math.max(new Date().getFullYear(), birthYear + 65);
    onChange(base + delta);
  }

  return (
    <div className="flex items-center gap-2">
      <Label className="!mt-0 whitespace-nowrap text-[12.5px] text-dim">{label} retirement year</Label>
      <Button type="button" variant="ghost" size="icon" className="size-7 cursor-pointer" onClick={() => step(-1)} aria-label={`Move ${label}'s retirement year earlier`}>
        <Minus className="size-3.5" />
      </Button>
      <Input
        type="number"
        placeholder="Not set"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Math.round(Number(e.target.value)))}
        className="w-24 text-center"
      />
      <Button type="button" variant="ghost" size="icon" className="size-7 cursor-pointer" onClick={() => step(1)} aria-label={`Move ${label}'s retirement year later`}>
        <Plus className="size-3.5" />
      </Button>
    </div>
  );
}
