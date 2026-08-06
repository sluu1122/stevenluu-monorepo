import { useEffect, useState, type ReactNode } from 'react';
import { DisplayCurrencyContext } from './display-currency-context';
import type { Currency } from '../engine/schema';

const DISPLAY_CURRENCY_KEY = 'retirement-planner:display-currency';

/**
 * Which currency the Planning Grid, Charts and Client Summary render their
 * figures in. This is a *display* conversion only - the engine still computes
 * everything in the scenario's own reporting currency, and nothing here is
 * written back to the scenario. Held above all three tabs so the choice
 * follows the user across them, the same way SelectedPersonProvider works.
 */
export function DisplayCurrencyProvider({ children }: { children: ReactNode }) {
  const [displayCurrency, setDisplayCurrency] = useState<Currency | null>(() => {
    const stored = window.localStorage.getItem(DISPLAY_CURRENCY_KEY);
    return stored === 'USD' || stored === 'CAD' ? stored : null;
  });

  useEffect(() => {
    if (displayCurrency) window.localStorage.setItem(DISPLAY_CURRENCY_KEY, displayCurrency);
    else window.localStorage.removeItem(DISPLAY_CURRENCY_KEY);
  }, [displayCurrency]);

  return <DisplayCurrencyContext.Provider value={{ displayCurrency, setDisplayCurrency }}>{children}</DisplayCurrencyContext.Provider>;
}
