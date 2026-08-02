import type { MouseEvent, ReactNode } from 'react';
import { RadioGroup, RadioGroupItem } from '@repo/ui/components/radio-group';

interface RetirementStartRadioGroupProps {
  value: number | null;
  onChange: (year: number) => void;
  children: ReactNode;
}

/** Wraps the whole grid so each row's radio item shares one accessible group. */
export function RetirementStartRadioGroup({ value, onChange, children }: RetirementStartRadioGroupProps) {
  return (
    <RadioGroup value={value !== null ? String(value) : undefined} onValueChange={(v: string) => onChange(Number(v))}>
      {children}
    </RadioGroup>
  );
}

export function RetirementStartRadioItem({ year }: { year: number }) {
  return <RadioGroupItem value={String(year)} aria-label={`Set retirement start year to ${year}`} onClick={(e: MouseEvent) => e.stopPropagation()} />;
}
