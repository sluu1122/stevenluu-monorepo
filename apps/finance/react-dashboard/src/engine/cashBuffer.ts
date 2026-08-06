import { isBucketAvailableAtAge, type AccountAvailabilityAges } from './accountKindMeta';
import { calculateTotalTax } from './calculateTax';
import type { AccountBucket, CashBufferRule, TaxConfig } from './schema';
import type { AuditStep } from './types';

export interface ReplenishResult {
  pulledFrom: Record<string, number>;
  /** Net amount that actually lands in the cash bucket, after any tax withheld on tax-deferred pulls. */
  amountTransferred: number;
  /** Gross taxable distribution taken from tax-deferred accounts, for the caller's incremental tax pass. */
  taxableDistribution: number;
  /** The incremental tax `taxableDistribution` itself triggers, already computed against the caller's base - exposed so the caller charges it exactly once rather than re-deriving it against a possibly different base. */
  taxOnDistribution: { federal: number; stateOrProvincial: number; total: number };
  steps: AuditStep[];
}

const EMPTY: ReplenishResult = {
  pulledFrom: {},
  amountTransferred: 0,
  taxableDistribution: 0,
  taxOnDistribution: { federal: 0, stateOrProvincial: 0, total: 0 },
  steps: [],
};

/**
 * Error shrinks by roughly the marginal rate each pass, so a low marginal
 * rate needs more passes to reach cent precision (0.15^6 still leaves ~2c on
 * a $20k pull). The loop exits as soon as it converges, so a generous cap
 * costs nothing.
 */
const GROSS_UP_ITERATIONS = 24;

/**
 * The gross withdrawal G from a tax-deferred account such that
 * `G - incrementalTax(G) === netNeeded`, capped by what's actually there.
 *
 * Topping up cash from a 401(k)/RRSP is a real taxable distribution, so
 * pulling exactly `netNeeded` would leave the buffer short by the tax. This
 * solves for the larger gross amount instead - what a real person does when
 * they withdraw extra to cover the withholding.
 *
 * Solved by fixed point (G₀ = netNeeded, Gₙ₊₁ = netNeeded + incrementalTax(Gₙ))
 * rather than algebraically, because the tax is a piecewise bracket walk.
 */
export function grossUpForNet(
  netNeeded: number,
  baseTaxableIncome: number,
  taxConfig: TaxConfig,
  available: number,
  socialSecurityBenefit = 0,
): number {
  if (netNeeded <= 0 || available <= 0) return 0;
  const baseTax = calculateTotalTax(baseTaxableIncome, taxConfig, socialSecurityBenefit).total;

  let gross = netNeeded;
  for (let i = 0; i < GROSS_UP_ITERATIONS; i++) {
    const incrementalTax = calculateTotalTax(baseTaxableIncome + gross, taxConfig, socialSecurityBenefit).total - baseTax;
    const next = netNeeded + incrementalTax;
    const converged = Math.abs(next - gross) < 1e-6;
    gross = next;
    if (converged) break;
  }
  return Math.min(gross, available);
}

/** How much tax-deferred money `pulledFrom` represents - the part that's a taxable distribution. */
export function taxableDistributionOf(pulledFrom: Record<string, number>, buckets: AccountBucket[]): number {
  return Object.entries(pulledFrom).reduce((sum, [bucketId, amount]) => {
    const bucket = buckets.find((b) => b.id === bucketId);
    return bucket?.taxTreatment === 'taxDeferred' ? sum + amount : sum;
  }, 0);
}

export interface ReplenishOptions {
  /** Ordered bucket ids to draw from. */
  replenishmentOrder: string[];
  buckets: AccountBucket[];
  balances: Record<string, number>;
  /** Age of the person whose accounts these are - gates which are reachable. */
  age: number;
  /** That person's taxable income so far this year, the base for the gross-up. */
  baseTaxableIncome: number;
  taxConfig: TaxConfig;
  /**
   * Buckets whose balances already count toward the buffer target. Drawing
   * from one of these just moves cash between two accounts that are both
   * being measured, leaving the shortfall exactly where it was - so they're
   * skipped as sources no matter where they sit in the order.
   */
  countedTowardTarget?: Set<string>;
  /**
   * Ceiling on the GROSS amount a given source may give up, over and above
   * what it holds. Used to stop a meltdown-funded top-up from drawing more
   * tax-deferred money than the bracket headroom the meltdown was aiming to
   * fill; anything beyond it falls through to the next source in the order.
   */
  maxGrossBySource?: Record<string, number>;
  /** Scenario-level overrides of the per-KIND availability age; statutory ages when omitted. */
  availabilityAges?: AccountAvailabilityAges;
  /** This person's US Social Security benefit this year, if any - see calculateTax.ts. */
  socialSecurityBenefit?: number;
}

/**
 * Pulls up to `netNeeded` into a cash bucket from `replenishmentOrder`.
 *
 * Taxable, tax-free and cash sources land one-for-one. A tax-deferred source
 * is grossed up so the NET landing in cash is what was asked for, with the
 * tax reported back via `taxableDistribution` for the caller to charge.
 * Returns early once the need is met.
 */
export function pullForNet(netNeeded: number, cashBucketId: string, options: ReplenishOptions): ReplenishResult {
  const { replenishmentOrder, buckets, balances, age, baseTaxableIncome, taxConfig, countedTowardTarget, maxGrossBySource, socialSecurityBenefit = 0 } =
    options;
  if (netNeeded <= 0) return EMPTY;

  const pulledFrom: Record<string, number> = {};
  const steps: AuditStep[] = [];
  let netRemaining = netNeeded;
  let taxableDistribution = 0;
  // The gross-up base grows as we take more, so a second tax-deferred pull is
  // priced against the brackets the first one already used up.
  let runningTaxableIncome = baseTaxableIncome;

  for (const sourceId of replenishmentOrder) {
    if (netRemaining <= 0.01) break;
    if (sourceId === cashBucketId || countedTowardTarget?.has(sourceId)) continue;

    const bucket = buckets.find((b) => b.id === sourceId);
    if (!bucket || !isBucketAvailableAtAge(bucket, age, options.availabilityAges)) continue;

    const balance = balances[sourceId] ?? 0;
    if (balance <= 0) continue;

    // A source can give up no more than it holds, and no more than any
    // gross ceiling placed on it (see maxGrossBySource).
    const available = Math.min(balance, maxGrossBySource?.[sourceId] ?? Number.POSITIVE_INFINITY);
    if (available <= 0) continue;

    const isTaxDeferred = bucket.taxTreatment === 'taxDeferred';
    const gross = isTaxDeferred
      ? grossUpForNet(netRemaining, runningTaxableIncome, taxConfig, available, socialSecurityBenefit)
      : Math.min(available, netRemaining);
    if (gross <= 0) continue;

    // When balance-limited, a grossed-up pull nets less than requested - the
    // shortfall simply carries into next year's top-up.
    const netLanded = isTaxDeferred
      ? gross -
        (calculateTotalTax(runningTaxableIncome + gross, taxConfig, socialSecurityBenefit).total -
          calculateTotalTax(runningTaxableIncome, taxConfig, socialSecurityBenefit).total)
      : gross;

    pulledFrom[sourceId] = (pulledFrom[sourceId] ?? 0) + gross;
    if (isTaxDeferred) {
      taxableDistribution += gross;
      runningTaxableIncome += gross;
    }
    netRemaining -= netLanded;

    steps.push({
      label: `Replenish cash from ${bucket.label}${isTaxDeferred ? ' (taxable distribution)' : ''}`,
      formula: isTaxDeferred ? 'gross withdrawal such that gross - incrementalTax = net needed, capped by balance' : 'min(bucketBalance, cashShortfall)',
      inputs: { bucketBalance: balance, netNeeded: netRemaining + netLanded, grossWithdrawn: gross },
      result: netLanded,
      relatedFields: ['cashBufferReplenishment'],
    });
  }

  const amountTransferred = Object.entries(pulledFrom).reduce((sum, [id, gross]) => {
    const bucket = buckets.find((b) => b.id === id);
    return sum + (bucket?.taxTreatment === 'taxDeferred' ? 0 : gross);
  }, 0);

  // Net landed = untaxed pulls in full, plus tax-deferred pulls less their tax.
  // This telescopes correctly even though the loop above priced each pull
  // against a RISING runningTaxableIncome (a bracket walk's tax is additive
  // over the income it's applied to, so summing each step's own increment
  // equals this one calculation against the total distribution).
  let taxOnDistribution = { federal: 0, stateOrProvincial: 0, total: 0 };
  if (taxableDistribution > 0) {
    const withDistribution = calculateTotalTax(baseTaxableIncome + taxableDistribution, taxConfig, socialSecurityBenefit);
    const without = calculateTotalTax(baseTaxableIncome, taxConfig, socialSecurityBenefit);
    taxOnDistribution = {
      federal: withDistribution.federal - without.federal,
      stateOrProvincial: withDistribution.stateOrProvincial - without.stateOrProvincial,
      total: withDistribution.total - without.total,
    };
  }

  return {
    pulledFrom,
    amountTransferred: amountTransferred + taxableDistribution - taxOnDistribution.total,
    taxableDistribution,
    taxOnDistribution,
    steps,
  };
}

/**
 * Tops a cash bucket back up to `targetMonthsOfSpending` worth of spending,
 * if the cash it's measured against has fallen below. Only ever adds - a
 * buffer already at or above target is left alone rather than swept back
 * into investments.
 *
 * `targetSpending` and `availableCash` must both be expressed in
 * `cashBucketId`'s own currency, since that's the currency the transfer
 * lands in.
 */
export function checkAndReplenish(
  balances: Record<string, number>,
  cashBucketId: string,
  rule: CashBufferRule,
  targetSpending: number,
  buckets: AccountBucket[],
  age: number,
  baseTaxableIncome: number,
  taxConfig: TaxConfig,
  options: {
    /**
     * Cash counted toward the target. Defaults to the destination bucket's
     * balance alone; pass the sum across every cash account the rule covers
     * to measure "how much cash is there" rather than "how much is in this
     * one account".
     */
    availableCash?: number;
    countedTowardTarget?: Set<string>;
    /** Overrides the rule's own source order - see the meltdown-first reordering in ledger.ts. */
    replenishmentOrder?: string[];
    maxGrossBySource?: Record<string, number>;
    availabilityAges?: AccountAvailabilityAges;
    /** This person's US Social Security benefit this year, if any - see calculateTax.ts. */
    socialSecurityBenefit?: number;
  } = {},
): ReplenishResult {
  if (!rule.enabled) return EMPTY;

  const targetAmount = (rule.targetMonthsOfSpending / 12) * targetSpending;
  const shortfall = Math.max(0, targetAmount - (options.availableCash ?? balances[cashBucketId] ?? 0));
  if (shortfall <= 0) return EMPTY;

  return pullForNet(shortfall, cashBucketId, {
    replenishmentOrder: options.replenishmentOrder ?? rule.replenishmentOrder,
    buckets,
    balances,
    age,
    baseTaxableIncome,
    taxConfig,
    countedTowardTarget: options.countedTowardTarget,
    maxGrossBySource: options.maxGrossBySource,
    availabilityAges: options.availabilityAges,
    socialSecurityBenefit: options.socialSecurityBenefit,
  });
}
