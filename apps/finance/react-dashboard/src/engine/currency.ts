import type { AccountBucket, Country, Currency, Scenario } from './schema';

const NATIVE_CURRENCY_BY_COUNTRY: Record<Country, Currency> = { US: 'USD', CA: 'CAD' };

/** An account bucket's kind fixes what currency it actually holds, independent of the scenario's chosen reporting currency. */
export function getBucketNativeCurrency(country: Country): Currency {
  return NATIVE_CURRENCY_BY_COUNTRY[country];
}

/** exchangeRateUsdToCad expresses how many CAD one USD buys. */
export function convertCurrency(amount: number, from: Currency, to: Currency, exchangeRateUsdToCad: number): number {
  if (from === to) return amount;
  return from === 'USD' ? amount * exchangeRateUsdToCad : amount / exchangeRateUsdToCad;
}

export function convertBucketAmountToScenarioCurrency(
  amount: number,
  bucket: Pick<AccountBucket, 'country'>,
  scenario: Pick<Scenario, 'currency' | 'exchangeRateUsdToCad'>,
): number {
  return convertCurrency(amount, getBucketNativeCurrency(bucket.country), scenario.currency, scenario.exchangeRateUsdToCad);
}
