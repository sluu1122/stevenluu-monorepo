import { cn } from '../lib/utils';

export type ValueBasis = 'nominal' | 'real';

const OPTIONS: { value: ValueBasis; label: string; title: string }[] = [
  { value: 'nominal', label: 'Nominal', title: 'Dollars of the year shown, inflation included' },
  // Deliberately not labelled "Real". That is the correct term of art, and the
  // grid still uses it as a column header, but it reads as jargon on a control
  // someone has to understand before clicking.
  { value: 'real', label: "Today's $", title: "Adjusted for inflation, in today's purchasing power" },
];

/**
 * Switches the charts between nominal dollars and today's dollars.
 *
 * Presentation only - the engine always projects in nominal terms and this
 * divides at the render boundary, exactly as the currency toggle converts
 * there rather than anywhere in the engine.
 */
export function ValueBasisToggle({ value, onChange }: { value: ValueBasis; onChange: (basis: ValueBasis) => void }) {
  return (
    <div className="inline-flex items-center rounded-[9px] border border-edge bg-surface-muted p-0.5 shrink-0" role="group" aria-label="Value basis">
      {OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={cn(
              'cursor-pointer rounded-[7px] px-2.5 py-1 text-[12px] font-medium transition-colors',
              selected ? 'bg-surface text-ink shadow-sm' : 'text-dim hover:text-ink',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
