import { useState } from 'react';
import { Input } from '@repo/ui/components/input';

interface MoneyInputProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

function formatDisplay(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) return '';
  return value.toLocaleString('en-US');
}

// Whole-dollar amounts only - digits typed past a decimal point are rounded
// to the nearest dollar on commit rather than rejected by validation. While
// editing, `draft` holds the raw in-progress text; once null (not focused),
// the display is derived straight from `value` so it stays comma-grouped
// without needing an effect to resync it.
export function MoneyInput({ value, onChange, placeholder, className, autoFocus }: MoneyInputProps) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <Input
      type="text"
      inputMode="decimal"
      className={className}
      placeholder={placeholder}
      autoFocus={autoFocus}
      value={draft ?? formatDisplay(value)}
      onFocus={() => setDraft(formatDisplay(value))}
      onChange={(e) => {
        const cleaned = e.target.value.replace(/[^0-9.]/g, '');
        setDraft(cleaned);
        if (cleaned === '' || cleaned === '.') {
          onChange(undefined);
          return;
        }
        const parsed = Math.round(Number(cleaned));
        onChange(Number.isNaN(parsed) ? undefined : parsed);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}
