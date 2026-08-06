import { generateId } from './id';
import type { AccountBucket, AccountKind, Country, TaxTreatment } from './schema';

export interface AccountKindMeta {
  label: string;
  country: Country;
  taxTreatment: TaxTreatment;
  isCashBuffer?: boolean;
  /**
   * Age this kind becomes reachable without penalty, or null for no
   * restriction. US registered accounts gate at 59.5; ages in the ledger are
   * whole numbers, so `age >= 59.5` first passes at 60 - deliberately
   * conservative. Canada has no MINIMUM withdrawal age for an RRSP (the
   * age-71 RRIF rule is a maximum, not a gate), and a TFSA has none either.
   *
   * This is the statutory rule, so it lives with the account kind rather than
   * on the account: it isn't a planning assumption a user should be setting
   * per account, and editing it was only ever a way to get the gate wrong.
   */
  defaultAvailableFromAge: number | null;
  /**
   * The increment this kind's contribution limit moves in when it's indexed,
   * or null for no rounding. TFSA, 401(k) and IRA limits are all legislated to
   * round to the nearest $500, so they sit flat for a few years and then step -
   * indexing them smoothly would show contributions no real account allows.
   *
   * Non-registered accounts have no limit at all, so an indexed contribution
   * there is just a saving rate keeping pace with inflation: no rounding.
   */
  contributionIndexRoundingStep: number | null;
}

export const ACCOUNT_KIND_META: Record<AccountKind, AccountKindMeta> = {
  US_CASH_HYSA: { label: 'Cash / HYSA', country: 'US', taxTreatment: 'taxable', isCashBuffer: true, defaultAvailableFromAge: null, contributionIndexRoundingStep: null },
  US_TAXABLE_BROKERAGE: { label: 'Taxable Brokerage', country: 'US', taxTreatment: 'taxable', defaultAvailableFromAge: null, contributionIndexRoundingStep: null },
  US_TRADITIONAL_401K_IRA: { label: 'Traditional 401(k)/IRA', country: 'US', taxTreatment: 'taxDeferred', defaultAvailableFromAge: 59.5, contributionIndexRoundingStep: 500 },
  US_ROTH_401K_IRA: { label: 'Roth 401(k)/IRA', country: 'US', taxTreatment: 'taxFree', defaultAvailableFromAge: 59.5, contributionIndexRoundingStep: 500 },
  CA_CASH_POOL: { label: 'Cash Pool', country: 'CA', taxTreatment: 'taxable', isCashBuffer: true, defaultAvailableFromAge: null, contributionIndexRoundingStep: null },
  CA_NON_REGISTERED: { label: 'Non-Registered', country: 'CA', taxTreatment: 'taxable', defaultAvailableFromAge: null, contributionIndexRoundingStep: null },
  // The RRSP dollar limit is indexed to average WAGE growth rather than CPI and
  // isn't rounded to a step, so it gets smooth indexing here - close enough,
  // and the 18%-of-earned-income rule that usually binds it isn't modelled.
  CA_RRSP_RRIF: { label: 'RRSP/RRIF', country: 'CA', taxTreatment: 'taxDeferred', defaultAvailableFromAge: null, contributionIndexRoundingStep: null },
  CA_TFSA: { label: 'TFSA', country: 'CA', taxTreatment: 'taxFree', defaultAvailableFromAge: null, contributionIndexRoundingStep: 500 },
};

/**
 * This year's contribution for an account whose limit tracks inflation:
 * indexed in the account's own currency, then snapped to the statutory step.
 * Returns the base amount untouched when indexing is off for that account.
 */
export function indexedContributionAmount(bucket: Pick<AccountBucket, 'kind' | 'annualContributionWhileWorking' | 'indexContributionToInflation'>, indexationFactor: number): number {
  const base = bucket.annualContributionWhileWorking ?? 0;
  if (!bucket.indexContributionToInflation || base <= 0) return base;

  const indexed = base * indexationFactor;
  const step = ACCOUNT_KIND_META[bucket.kind]?.contributionIndexRoundingStep ?? null;
  return step && step > 0 ? Math.round(indexed / step) * step : indexed;
}

/**
 * Per-KIND overrides of the statutory availability age, as held on a scenario.
 * A missing entry means "use the statutory age"; an entry of null means no
 * restriction. Passing nothing resolves to the statutory ages throughout.
 */
export type AccountAvailabilityAges = Partial<Record<AccountKind, number | null>>;

/** The age this account becomes reachable - the scenario's override if it has one, else the statutory age. */
export function availableFromAgeFor(bucket: Pick<AccountBucket, 'kind'>, overrides?: AccountAvailabilityAges): number | null {
  if (overrides && Object.prototype.hasOwnProperty.call(overrides, bucket.kind)) return overrides[bucket.kind] ?? null;
  return ACCOUNT_KIND_META[bucket.kind]?.defaultAvailableFromAge ?? null;
}

/**
 * True when `age` can reach this account. Derived from the account's KIND
 * rather than stored per account - the gate is the government's rule, not a
 * planning assumption - with a scenario-level override for the cases where the
 * user knows better than the seeded figure.
 */
export function isBucketAvailableAtAge(bucket: Pick<AccountBucket, 'kind'>, age: number, overrides?: AccountAvailabilityAges): boolean {
  const from = availableFromAgeFor(bucket, overrides);
  return from == null || age >= from;
}

export const US_ACCOUNT_KINDS: AccountKind[] = ['US_CASH_HYSA', 'US_TAXABLE_BROKERAGE', 'US_TRADITIONAL_401K_IRA', 'US_ROTH_401K_IRA'];
export const CA_ACCOUNT_KINDS: AccountKind[] = ['CA_CASH_POOL', 'CA_NON_REGISTERED', 'CA_RRSP_RRIF', 'CA_TFSA'];

/** A newly added account starts blank - the user fills in real balances and rates. */
export function createBlankAccountBucket(kind: AccountKind): AccountBucket {
  const meta = ACCOUNT_KIND_META[kind];
  return {
    id: generateId('bucket'),
    label: meta.label,
    country: meta.country,
    kind,
    taxTreatment: meta.taxTreatment,
    startingBalance: 0,
    isCashBuffer: meta.isCashBuffer,
  };
}

/** Every kind, in the order a drawdown normally wants: cash, then taxable, then tax-deferred, then tax-free. */
export const DEFAULT_HOUSEHOLD_WITHDRAWAL_ORDER: AccountKind[] = [
  'CA_CASH_POOL',
  'US_CASH_HYSA',
  'CA_NON_REGISTERED',
  'US_TAXABLE_BROKERAGE',
  'CA_RRSP_RRIF',
  'US_TRADITIONAL_401K_IRA',
  'CA_TFSA',
  'US_ROTH_401K_IRA',
];
