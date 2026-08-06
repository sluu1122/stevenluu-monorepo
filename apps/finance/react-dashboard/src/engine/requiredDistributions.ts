import { isBucketAvailableAtAge, type AccountAvailabilityAges } from './accountKindMeta';
import type { AccountBucket, Country } from './schema';
import type { AuditStep } from './types';

/**
 * Statutory minimum withdrawals from tax-deferred retirement accounts - the
 * US "required minimum distribution" (RMD) and its Canadian equivalent, the
 * RRIF minimum. Both work the same way: once you reach a given age, a
 * government-set fraction of the account's balance at the END OF THE PRIOR
 * YEAR must come out, whether you need the money or not, and it's taxed as
 * ordinary income.
 *
 * This is the counterpart to a meltdown rule: a meltdown is discretionary and
 * capped by a tax-bracket target, whereas this is compulsory and capped by
 * nothing. Modelling it matters precisely because it can force income into a
 * higher bracket later - which is the whole reason to melt down earlier.
 */

/**
 * IRS Uniform Lifetime Table - the divisor ("distribution period") applied to
 * the prior year-end balance. Unchanged since it took effect on 2022-01-01
 * (T.D. 9930); the ages at which it STARTS applying were what SECURE 2.0
 * changed. Used for anyone whose account is US-domiciled.
 */
const US_UNIFORM_LIFETIME_DIVISOR: Record<number, number> = {
  72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1,
  80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4,
  88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9,
  96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4, 101: 6.0, 102: 5.6, 103: 5.2,
  104: 4.9, 105: 4.6, 106: 4.3, 107: 4.1, 108: 3.9, 109: 3.7, 110: 3.5, 111: 3.4,
  112: 3.3, 113: 3.1, 114: 3.0, 115: 2.9, 116: 2.8, 117: 2.7, 118: 2.5, 119: 2.3,
  120: 2.0,
};

const US_OLDEST_TABLE_AGE = 120;

/**
 * Canada's prescribed RRIF factors, as a percentage of the prior year-end
 * balance. Set in the Income Tax Regulations and unchanged since 2015.
 * Below 71 there is no table - the factor is 1/(90 - age), which reproduces
 * these published rows exactly (age 65 -> 1/25 -> 4.00%).
 */
const CA_RRIF_FACTOR_PCT: Record<number, number> = {
  71: 5.28, 72: 5.40, 73: 5.53, 74: 5.67, 75: 5.82, 76: 5.98, 77: 6.17, 78: 6.36,
  79: 6.58, 80: 6.82, 81: 7.08, 82: 7.38, 83: 7.71, 84: 8.08, 85: 8.51, 86: 8.99,
  87: 9.55, 88: 10.21, 89: 10.99, 90: 11.92, 91: 13.06, 92: 14.49, 93: 16.34,
  94: 18.79, 95: 20.00,
};

const CA_OLDEST_TABLE_AGE = 95;

/**
 * The age at which withdrawals become compulsory, absent an override.
 *
 * US: SECURE 2.0 sets this by birth year - 73 for those born 1951-1959 and 75
 * for 1960 onward. Anyone born earlier was already subject to it under the
 * previous rules.
 *
 * Canada: an RRSP must be converted to a RRIF by the end of the year the
 * holder turns 71, and the first minimum withdrawal is required for the
 * following year - so the first year money is actually forced out is 72.
 */
export function statutoryDistributionStartAge(country: Country, birthYear: number): number {
  if (country === 'CA') return 72;
  if (birthYear >= 1960) return 75;
  if (birthYear >= 1951) return 73;
  return 72;
}

/**
 * The fraction of the prior year-end balance that must be withdrawn at `age`.
 * Returns 0 below the age where either regime has any factor at all - callers
 * gate on the start age separately, since that's a per-person rule rather
 * than a property of the table.
 */
export function requiredDistributionFactor(country: Country, age: number): number {
  const wholeAge = Math.floor(age);
  if (country === 'CA') {
    if (wholeAge >= CA_OLDEST_TABLE_AGE) return CA_RRIF_FACTOR_PCT[CA_OLDEST_TABLE_AGE] / 100;
    const tabled = CA_RRIF_FACTOR_PCT[wholeAge];
    if (tabled !== undefined) return tabled / 100;
    // Below the published table: the statutory 1/(90 - age) formula.
    return wholeAge < 90 ? 1 / (90 - wholeAge) : 1;
  }
  if (wholeAge >= US_OLDEST_TABLE_AGE) return 1 / US_UNIFORM_LIFETIME_DIVISOR[US_OLDEST_TABLE_AGE];
  const divisor = US_UNIFORM_LIFETIME_DIVISOR[wholeAge];
  return divisor === undefined ? 0 : 1 / divisor;
}

export interface RequiredDistributionResult {
  /** Gross amount forced out of each account, in that account's own currency. */
  withdrawals: Record<string, number>;
  totalWithdrawn: number;
  steps: AuditStep[];
}

/**
 * Every compulsory withdrawal this person owes for the year, across all of
 * their tax-deferred accounts.
 *
 * `balancesAtYearStart` is the basis, not the live balances: the rules key off
 * the prior 31 December closing balance, which is exactly what the year-start
 * snapshot holds. The live balance only caps it - an account can't hand over
 * more than it still contains.
 *
 * Accounts the person can't legally reach yet are skipped, though in practice
 * that can't bind: every age gate in the app is well below any start age here.
 */
export function calculateRequiredDistributions(
  buckets: AccountBucket[],
  balancesAtYearStart: Record<string, number>,
  balances: Record<string, number>,
  birthYear: number,
  age: number,
  startAgeOverride: number | null,
  availabilityAges?: AccountAvailabilityAges,
): RequiredDistributionResult {
  const withdrawals: Record<string, number> = {};
  const steps: AuditStep[] = [];
  let totalWithdrawn = 0;

  for (const bucket of buckets) {
    if (bucket.taxTreatment !== 'taxDeferred') continue;
    if (!isBucketAvailableAtAge(bucket, age, availabilityAges)) continue;

    const startAge = startAgeOverride ?? statutoryDistributionStartAge(bucket.country, birthYear);
    if (age < startAge) continue;

    const basis = balancesAtYearStart[bucket.id] ?? 0;
    if (basis <= 0) continue;

    const factor = requiredDistributionFactor(bucket.country, age);
    if (factor <= 0) continue;

    const required = Math.min(basis * factor, balances[bucket.id] ?? 0);
    if (required <= 0.01) continue;

    withdrawals[bucket.id] = (withdrawals[bucket.id] ?? 0) + required;
    totalWithdrawn += required;

    const isCanadian = bucket.country === 'CA';
    steps.push({
      label: `${isCanadian ? 'RRIF minimum' : 'Required minimum distribution'} - ${bucket.label}`,
      formula: isCanadian
        ? 'priorYearEndBalance × prescribed RRIF factor for this age'
        : 'priorYearEndBalance ÷ IRS Uniform Lifetime Table divisor for this age',
      inputs: {
        priorYearEndBalance: basis,
        age: Math.floor(age),
        [isCanadian ? 'factorPct' : 'divisor']: isCanadian ? factor * 100 : 1 / factor,
        startAge,
      },
      result: required,
      relatedFields: ['requiredDistributionTotal'],
    });
  }

  return { withdrawals, totalWithdrawn, steps };
}
