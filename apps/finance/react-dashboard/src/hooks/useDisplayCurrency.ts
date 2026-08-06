import { useContext } from 'react';
import { DisplayCurrencyContext } from '../providers/display-currency-context';
import { convertCurrency } from '../engine/currency';
import { formatCompactCurrency, formatCurrency } from '../lib/format';
import type { Currency, Scenario } from '../engine/schema';

export function useDisplayCurrency() {
  const ctx = useContext(DisplayCurrencyContext);
  if (!ctx) throw new Error('useDisplayCurrency must be used within a DisplayCurrencyProvider');
  return ctx;
}

export interface MoneyFormatter {
  /** The currency figures are actually being shown in right now. */
  currency: Currency;
  /** Converts a figure from the scenario's reporting currency into the display one. */
  convert: (value: number) => number;
  format: (value: number) => string;
  formatCompact: (value: number) => string;
  /** True when we're re-expressing the scenario's own figures in a different currency. */
  isConverted: boolean;
}

/**
 * Formats engine output for display. Every figure the engine produces is
 * already normalized to `scenario.currency`, so re-expressing the whole grid
 * in the other currency is a single conversion at the scenario's own rate -
 * applied here at the render boundary rather than anywhere in the engine.
 */
export function useMoney(scenario: Pick<Scenario, 'currency' | 'exchangeRateUsdToCad'> | null): MoneyFormatter {
  const { displayCurrency } = useDisplayCurrency();
  const base = scenario?.currency ?? 'USD';
  const target = displayCurrency ?? base;
  const rate = scenario?.exchangeRateUsdToCad ?? 1;

  const convert = (value: number) => convertCurrency(value, base, target, rate);

  return {
    currency: target,
    convert,
    format: (value) => formatCurrency(convert(value), target),
    formatCompact: (value) => formatCompactCurrency(convert(value), target),
    isConverted: target !== base,
  };
}
