import { useDisplayCurrency } from '../hooks/useDisplayCurrency';
import { cn } from '../lib/utils';
import type { Currency } from '../engine/schema';

const CURRENCIES: Currency[] = ['CAD', 'USD'];

/**
 * Re-expresses every figure on the current tab in the chosen currency. This is
 * presentation only - the scenario keeps reporting in its own currency, and the
 * conversion uses that scenario's own exchange rate.
 */
export function DisplayCurrencyToggle({ scenarioCurrency }: { scenarioCurrency: Currency }) {
  const { displayCurrency, setDisplayCurrency } = useDisplayCurrency();
  const active = displayCurrency ?? scenarioCurrency;

  return (
    <div className="inline-flex items-center rounded-[9px] border border-edge bg-surface-muted p-0.5 shrink-0" role="group" aria-label="Display currency">
      {CURRENCIES.map((currency) => {
        const selected = active === currency;
        return (
          <button
            key={currency}
            type="button"
            aria-pressed={selected}
            // Picking the scenario's own currency clears the override rather than
            // pinning it, so switching to a scenario that reports differently
            // follows that scenario instead of silently converting.
            onClick={() => setDisplayCurrency(currency === scenarioCurrency ? null : currency)}
            className={cn(
              'cursor-pointer rounded-[7px] px-2.5 py-1 text-[12px] font-medium transition-colors',
              selected ? 'bg-surface text-ink shadow-sm' : 'text-dim hover:text-ink',
            )}
          >
            {currency}
          </button>
        );
      })}
    </div>
  );
}
