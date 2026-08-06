import { createContext } from 'react';
import type { Currency } from '../engine/schema';

export interface DisplayCurrencyContextValue {
  /** Null means "follow whatever the active scenario reports in" - the default. */
  displayCurrency: Currency | null;
  setDisplayCurrency: (currency: Currency | null) => void;
}

export const DisplayCurrencyContext = createContext<DisplayCurrencyContextValue | null>(null);
