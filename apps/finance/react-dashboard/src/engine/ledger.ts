import type { AccountBucket, GridOverride, IncomeSource, PersonPlan, Scenario, TaxConfig } from './schema';
import type { AuditStep, EngineWarning, LedgerResult, LedgerYearRow } from './types';
import { getInflationRateForYear } from './inflation';
import { applyOasClawback, calculateBenefitForYear } from './benefits';
import { OAS_CLAWBACK_THRESHOLD_2025 } from './benefitDefaults';
import { indexedContributionAmount, isBucketAvailableAtAge } from './accountKindMeta';
import { calculateTotalTax, indexTaxConfig } from './calculateTax';
import { checkAndReplenish, grossUpForNet, type ReplenishResult } from './cashBuffer';
import { applyGrowth } from './growth';
import { calculateMeltdownWithdrawal } from './meltdown';
import { calculateRequiredDistributions } from './requiredDistributions';
import { DEFAULT_REQUIRED_DISTRIBUTION_RULE, returnRatePctFor } from './schema';
import { getProjectionHorizonEndYear } from './household';
import { convertBucketAmountToScenarioCurrency } from './currency';

function findOverride(overrides: GridOverride[], personId: string, year: number, field: string): GridOverride | undefined {
  return overrides.find((o) => o.personId === personId && o.year === year && o.field === field);
}

/**
 * Every balance in this engine is held in the SCENARIO's reporting currency,
 * not the account's native one.
 *
 * The user still enters a US account's balance in USD, so the conversion
 * happens once, where those figures enter the engine: seeding `balances` and
 * reading `annualContributionWhileWorking` (see buildScenarioLedger). After
 * that a dollar is a dollar everywhere.
 *
 * This matters because balances don't only meet each other - they meet
 * spending, income, tax brackets and meltdown ceilings, all of which are
 * quoted in the scenario currency. Converting at the reporting boundary
 * instead (as this used to) left every one of those comparisons mixing units:
 * a 258,000 CAD meltdown ceiling withdrew 258,000 USD, and the resulting
 * income was taxed as though the USD figure were already CAD. Growth is a
 * percentage and contributions are converted on the way in, so nothing else
 * needs to know about currency at all.
 */
function pickBucketAmounts(record: Record<string, number>, buckets: AccountBucket[]): Record<string, number> {
  const picked: Record<string, number> = {};
  for (const bucket of buckets) {
    if (record[bucket.id] !== undefined) picked[bucket.id] = record[bucket.id];
  }
  return picked;
}

function activeIncomeAmount(source: IncomeSource, year: number): number {
  if (year < source.startYear) return 0;
  if (source.endYear !== undefined && year > source.endYear) return 0;
  const yearsElapsed = year - source.startYear;
  return source.annualAmountNominal * Math.pow(1 + source.growthRatePct / 100, yearsElapsed);
}

/** A person's income compounds from the projection's start year and stops the year their own retirement begins. */
function activePersonIncome(plan: PersonPlan, year: number, projectionStartYear: number): number {
  if (plan.retirementStartYear !== null && year >= plan.retirementStartYear) return 0;
  const yearsElapsed = year - projectionStartYear;
  return plan.annualIncomeNominal * Math.pow(1 + plan.incomeGrowthRatePct / 100, yearsElapsed);
}

/** Per-person values that carry from one year to the next. */
interface PersonYearState {
  cumulativeInflationFactor: number;
  preRetirementInflationFactor: number;
  previousYearTaxableIncome: number;
}

/**
 * Rolls this person's inflation factors forward into `year`. Split out so
 * every person's spending is known before any of them runs.
 */
function advanceInflation(plan: PersonPlan, scenario: Scenario, year: number, startYear: number, state: PersonYearState): void {
  const isRetired = plan.retirementStartYear !== null && year >= plan.retirementStartYear;
  if (isRetired) {
    if (year === plan.retirementStartYear) {
      state.cumulativeInflationFactor = 1;
    } else {
      state.cumulativeInflationFactor *= 1 + getInflationRateForYear(scenario.inflation, year);
    }
  } else if (year > startYear) {
    state.preRetirementInflationFactor *= 1 + getInflationRateForYear(scenario.inflation, year);
  }
}

/**
 * The household's spending for one year. Budgeted once for the household, so
 * there is no per-person figure to compute here - what each person's row
 * reports as "spending" is derived after the fact from what they actually
 * funded (see fundedSpendingByPerson).
 */
interface HouseholdSpending {
  nominalTotal: number;
  realTotal: number;
  isRetired: boolean;
  inflationFactor: number;
}

function householdSpendingFor(scenario: Scenario, isRetired: boolean, inflationFactor: number, year: number, overrides: GridOverride[]): HouseholdSpending {
  const realTotal = isRetired ? scenario.householdSpendingRealAtRetirement : scenario.householdSpendingRealBeforeRetirement;
  // A spendingNominal override is stored per person-year, but there is only one
  // budget to override now, so the first one found for this year sets it for
  // the whole household rather than for one person's vanished share.
  const override = scenario.persons.map((person) => findOverride(overrides, person.id, year, 'spendingNominal')).find(Boolean);
  const nominalTotal = override ? override.value : realTotal * inflationFactor;

  return { nominalTotal, realTotal, isRetired, inflationFactor };
}

/**
 * Everything about a person's year that's knowable before any withdrawal
 * happens - spending, income and benefits don't depend on where the money
 * to cover them comes from. That's what makes pre-funding the cash buffer
 * possible: this can all be computed for every person up front, before
 * anyone draws on a shared account.
 */
interface PersonNeeds {
  isRetired: boolean;
  overriddenFields: string[];
  incomes: LedgerYearRow['incomes'];
  totalIncomes: number;
  benefits: LedgerYearRow['benefits'];
  totalBenefits: number;
  audit: AuditStep[];
}

function computePersonNeeds(
  plan: PersonPlan,
  year: number,
  age: number,
  startYear: number,
  state: PersonYearState,
  overrides: GridOverride[],
  oasClawbackThreshold: number,
): PersonNeeds {
  const audit: AuditStep[] = [];
  const overriddenFields: string[] = [];
  const isRetired = plan.retirementStartYear !== null && year >= plan.retirementStartYear;

  if (findOverride(overrides, plan.id, year, 'spendingNominal')) overriddenFields.push('spendingNominal');

  const incomes = [
    { sourceId: plan.id, amount: activePersonIncome(plan, year, startYear) },
    ...plan.incomeSources.map((source) => ({ sourceId: source.id, amount: activeIncomeAmount(source, year) })),
  ];
  const totalIncomes = incomes.reduce((sum, i) => sum + i.amount, 0);

  const benefits: { type: string; amount: number }[] = [];
  let totalBenefits = 0;
  for (const benefit of plan.benefits) {
    const { amount: grossAmount, steps } = calculateBenefitForYear(benefit, age);
    audit.push(...steps);

    let amount = grossAmount;
    if (benefit.type === 'CA_OAS' && grossAmount > 0) {
      // Clawback is based on the PRIOR tax year's net income (the real CRA
      // mechanism, and it sidesteps the circularity of testing against an
      // income figure that includes the OAS itself). It's this person's own
      // prior-year total - the clawback is an individual test, not a
      // household one - already inclusive of any cash-buffer replenishment
      // distribution from last year, since that's folded into
      // `previousYearTaxableIncome` when the year that generated it finalized.
      const clawbackResult = applyOasClawback(grossAmount, state.previousYearTaxableIncome, oasClawbackThreshold);
      amount = clawbackResult.netAmount;
      audit.push(...clawbackResult.steps);
    }

    if (amount > 0) benefits.push({ type: benefit.type, amount });
    totalBenefits += amount;
  }

  return { isRetired, overriddenFields, incomes, totalIncomes, benefits, totalBenefits, audit };
}

/**
 * What cash-buffer replenishment did for one person this year, accumulated
 * BEFORE their own spending/tax step runs (see buildScenarioLedger's Phase 1)
 * so it can be folded into that step's tax calculation.
 */
interface ReplenishmentOutcome {
  withdrawals: Record<string, number>;
  /**
   * The other half of `withdrawals` - what actually landed in each cash bucket,
   * in that bucket's native currency. Recorded as a normal contribution on the
   * row so a bucket's End reconciles from its own columns
   * (End = Start - Withdrawal + Contribution + Growth) without the reader
   * having to know a transfer happened off to the side.
   */
  credits: Record<string, number>;
  /** Scenario-currency amount actually transferred into the cash bucket(s). */
  cashBufferReplenishment: number;
  /** Gross statutory minimum distributions taken this year, for the row's own column. */
  requiredDistribution: number;
  /** Gross tax-deferred amount pulled - stacks into this person's grossTaxableIncome. */
  taxableDistribution: number;
  /** Tax already charged (and self-funded out of the distribution) on `taxableDistribution`. */
  taxesPaid: { federal: number; stateOrProvincial: number; total: number };
  audit: AuditStep[];
}

function emptyReplenishmentOutcome(): ReplenishmentOutcome {
  return {
    withdrawals: {},
    credits: {},
    cashBufferReplenishment: 0,
    requiredDistribution: 0,
    taxableDistribution: 0,
    taxesPaid: { federal: 0, stateOrProvincial: 0, total: 0 },
    audit: [],
  };
}

/**
 * Folds one `pullForNet`/`checkAndReplenish` result into a person's running
 * outcome for the year. Withdrawals are summed (not overwritten) since a
 * bucket can be pulled from by more than one replenishment call - a shared
 * buffer's proportional pass and second sweep can both touch the same person.
 */
function accumulateReplenishment(outcome: ReplenishmentOutcome, result: ReplenishResult, cashBucket: AccountBucket): void {
  for (const [bucketId, amount] of Object.entries(result.pulledFrom)) {
    outcome.withdrawals[bucketId] = (outcome.withdrawals[bucketId] ?? 0) + amount;
  }
  outcome.credits[cashBucket.id] = (outcome.credits[cashBucket.id] ?? 0) + result.amountTransferred;
  outcome.cashBufferReplenishment += result.amountTransferred;
  outcome.taxableDistribution += result.taxableDistribution;
  outcome.taxesPaid = {
    federal: outcome.taxesPaid.federal + result.taxOnDistribution.federal,
    stateOrProvincial: outcome.taxesPaid.stateOrProvincial + result.taxOnDistribution.stateOrProvincial,
    total: outcome.taxesPaid.total + result.taxOnDistribution.total,
  };
  outcome.audit.push(...result.steps);
}

/**
 * A row before `accountEnd`/`totalNetWorth` are known. Those two can only be
 * filled in after shared-account growth has run for the year, which happens
 * once at household level after every person's flows - see buildScenarioLedger.
 */
type DraftLedgerYearRow = Omit<LedgerYearRow, 'accountEnd' | 'totalNetWorth'>;

/**
 * What the household-wide passes produced for one person, so their row can be
 * assembled without re-deriving it.
 */
interface HouseholdDrawShare {
  /** Withdrawals from accounts this person OWNS, plus any shared-bucket draw attributed to them. */
  withdrawals: Record<string, number>;
  /** The subset of those that funded SPENDING rather than the tax bill - what this person contributed to the budget. */
  spendingWithdrawals: number;
  /** Income and benefits of theirs that went toward the household budget rather than to surplus. */
  incomeUsedForSpending: number;
  audit: AuditStep[];
  warnings: EngineWarning[];
}

/**
 * Draws `need` from every account in the household, in the scenario's kind
 * order, and reports what came out of each.
 *
 * This is the point of a household order: a person can only reach their own
 * accounts and joint ones, but a HOUSEHOLD can reach all of them, and in
 * reality that is what it does - one partner's spending is funded by whichever
 * account the household has decided to spend down first, whoever holds it. A
 * kind left out of the order is unreachable here, which is how an account is
 * kept off-limits to spending while replenishment and statutory minimums can
 * still touch it.
 *
 * Within one kind the draw is PROPORTIONAL across the accounts of that kind,
 * so two people's accounts drain together rather than one being emptied first.
 *
 * The age gate follows the account's OWNER, not whoever the money is spent on:
 * drawing a 401(k) is gated on its owner turning 59.5.
 */
function drawHouseholdWide(
  need: number,
  scenario: Scenario,
  balances: Record<string, number>,
  year: number,
  ageByBucketId: Map<string, number>,
): { withdrawals: Record<string, number>; steps: AuditStep[]; warning?: EngineWarning } {
  const withdrawals: Record<string, number> = {};
  const steps: AuditStep[] = [];
  let remaining = Math.max(0, need);
  let ageBlockedBalance = 0;

  const jointIds = new Set(scenario.sharedAccountBuckets.map((b) => b.id));
  const allBuckets = [...scenario.sharedAccountBuckets, ...scenario.persons.flatMap((p) => p.accountBuckets)];

  for (const kind of scenario.householdWithdrawalOrder) {
    if (remaining <= 0.005) break;
    const ofKind = allBuckets.filter((b) => b.kind === kind);

    // Joint before personal: a household spends what it holds together first,
    // and a joint account has no owner whose brackets could be spread anyway.
    for (const joint of [true, false]) {
      if (remaining <= 0.005) break;
      const tier = ofKind.filter((b) => jointIds.has(b.id) === joint);

      const reachable = tier.filter((bucket) => {
        if (isBucketAvailableAtAge(bucket, ageByBucketId.get(bucket.id) ?? 0, scenario.accountAvailabilityAges)) return true;
        ageBlockedBalance += Math.max(0, balances[bucket.id] ?? 0);
        return false;
      });

      const available = reachable.reduce((sum, b) => sum + Math.max(0, balances[b.id] ?? 0), 0);
      if (available <= 0.005) continue;

      const take = Math.min(remaining, available);
      for (const bucket of reachable) {
        const balance = Math.max(0, balances[bucket.id] ?? 0);
        if (balance <= 0) continue;
        // Proportional, not first-come: two people's accounts of one kind drain
        // together, so neither sits untouched while the other is run down, and
        // the taxable income they generate is spread over BOTH sets of tax
        // brackets rather than stacked into one.
        const amount = take * (balance / available);
        withdrawals[bucket.id] = (withdrawals[bucket.id] ?? 0) + amount;
        balances[bucket.id] = balance - amount;
        steps.push({
          label: `Withdraw from ${bucket.label}`,
          formula: 'need for this account kind × (this account’s balance ÷ every reachable balance of that kind)',
          inputs: { needForKind: take, bucketBalance: balance, reachableBalanceOfKind: available },
          result: amount,
          relatedFields: [`withdrawals.${bucket.id}`],
        });
      }
      remaining -= take;
    }
  }

  const warning =
    remaining > 0.005
      ? {
          year,
          message: `Shortfall of ${remaining.toFixed(2)}: every account in the household's withdrawal order was exhausted before the spending/tax need was met.${
            ageBlockedBalance > 0.01 ? ` ${ageBlockedBalance.toFixed(2)} is held in accounts not yet available at age.` : ''
          }`,
        }
      : undefined;

  return { withdrawals, steps, warning };
}

/**
 * The share of a taxable account's return that is PAID OUT each year - interest
 * and dividends, taxable as earned - rather than left to appreciate untaxed
 * until the holding is sold.
 *
 * A cash account is a special case with no judgement in it: its entire return
 * is interest, so all of it is taxable every year. That matters more than it
 * looks, since a household buffer can be a large standing balance.
 */
function distributionYieldPctFor(bucket: AccountBucket, scenario: Scenario, isRetired: boolean): number {
  if (bucket.taxTreatment !== 'taxable' || !scenario.taxableAccountTaxation.enabled) return 0;
  if (bucket.isCashBuffer) return returnRatePctFor(bucket, scenario.returnRates, isRetired);
  return scenario.taxableAccountTaxation.annualDistributionYieldPct;
}

/**
 * The taxable gain realized by selling `amount` out of a taxable account, and
 * how much cost basis that sale consumes.
 *
 * Proportional, which is the adjusted-cost-base rule: selling a tenth of an
 * account realizes a tenth of its embedded gain. Losses are floored at zero
 * rather than carried forward - a capital loss can only offset a capital gain,
 * and tracking that carry-forward would add machinery for a case a
 * deterministic always-positive return path can barely produce.
 */
function realizeGain(amount: number, marketValue: number, basis: number, inclusionRatePct: number): { taxableGain: number; basisConsumed: number } {
  if (amount <= 0.005 || marketValue <= 0.005) return { taxableGain: 0, basisConsumed: 0 };
  const basisConsumed = Math.min(basis, amount * Math.min(1, basis / marketValue));
  return { taxableGain: Math.max(0, amount - basisConsumed) * (inclusionRatePct / 100), basisConsumed };
}

/** The extra tax `amount` costs on top of `base` - the marginal cost of one more distribution. */
function incrementalTaxOn(
  base: number,
  amount: number,
  taxConfig: TaxConfig,
  socialSecurityBenefit = 0,
): { federal: number; stateOrProvincial: number; total: number } {
  const withAmount = calculateTotalTax(base + amount, taxConfig, socialSecurityBenefit);
  const without = calculateTotalTax(base, taxConfig, socialSecurityBenefit);
  return {
    federal: withAmount.federal - without.federal,
    stateOrProvincial: withAmount.stateOrProvincial - without.stateOrProvincial,
    total: withAmount.total - without.total,
  };
}

/**
 * Redistribution passes within one tier. A grossed-up pull can be capped by
 * the account's own balance and so land less than its proportional share; the
 * passes hand that residue to whoever in the tier still has room. The loop
 * exits as soon as a pass makes no progress, so a generous cap costs nothing.
 */
const TIER_REDISTRIBUTION_PASSES = 8;

interface HouseholdReplenishOptions {
  scenario: Scenario;
  balances: Record<string, number>;
  /** Age of each bucket's OWNER this year - what the availability gate is tested against. */
  ageByBucketId: Map<string, number>;
  ownerOf: (bucketId: string) => string;
  /**
   * Each person's taxable income so far this year, the base their gross-ups are
   * priced against. Mutated as tax-deferred money is drawn, so a later pull
   * from the same person is priced against the brackets an earlier one used.
   */
  baseTaxableIncomeByPersonId: Map<string, number>;
  /** Each person's US Social Security benefit this year, if any - see calculateTax.ts. */
  socialSecurityBenefitByPersonId: Map<string, number>;
  taxConfig: TaxConfig;
  /** Buckets that may not fund the top-up at all. */
  excluded: Set<string>;
  /** Meltdown sources, drawn ahead of the kind order and only up to their own ceiling. */
  priority: string[];
  maxGrossBySource: Record<string, number>;
}

/**
 * Tops the household's cash back up to target out of the household's accounts
 * as a whole, in the scenario's kind order - the same pooling the spending
 * draw uses, applied to the one mechanism that used to sit outside it.
 *
 * Funding the buffer per person, each from their own list, meant a person whose
 * own taxable accounts had run dry reached into their tax-free ones while their
 * partner still held plenty of taxable investments. Nothing about the top-up is
 * personal - it fills one shared account against one household target - so the
 * money comes from wherever the household has decided to spend down first.
 *
 * Two things stay personal, because they genuinely are:
 *   - TAX. A tax-deferred pull is assessed to whoever owns the account, so each
 *     one is grossed up against its own owner's brackets and reported back on
 *     that owner's row. That is also what keeps the row's Start and End
 *     reconciling.
 *   - EXCLUSIONS. A bucket its owner left out of their replenishment order stays
 *     out. That list no longer decides the ORDER (the kind order does), but it
 *     is still how an account is kept off limits to the top-up entirely.
 *
 * Kinds the household order doesn't mention are appended at the end rather than
 * being unreachable: leaving a kind out means "don't SPEND this", and the top-up
 * keeping its own rules is the distinction that choice rests on.
 */
function replenishHouseholdWide(netNeeded: number, options: HouseholdReplenishOptions): Map<string, ReplenishResult> {
  const { scenario, balances, ageByBucketId, ownerOf, baseTaxableIncomeByPersonId, socialSecurityBenefitByPersonId, taxConfig, excluded, priority, maxGrossBySource } =
    options;

  const results = new Map<string, ReplenishResult>();
  const resultFor = (personId: string): ReplenishResult => {
    let result = results.get(personId);
    if (!result) {
      result = { pulledFrom: {}, amountTransferred: 0, taxableDistribution: 0, taxOnDistribution: { federal: 0, stateOrProvincial: 0, total: 0 }, steps: [] };
      results.set(personId, result);
    }
    return result;
  };

  const jointIds = new Set(scenario.sharedAccountBuckets.map((b) => b.id));
  const allBuckets = [...scenario.sharedAccountBuckets, ...scenario.persons.flatMap((p) => p.accountBuckets)];
  const drawnGross: Record<string, number> = {};

  /** The most this account may still give up: what it holds, less any meltdown ceiling already used. */
  const capacityOf = (bucket: AccountBucket): number => {
    const balance = Math.max(0, balances[bucket.id] ?? 0);
    const ceiling = maxGrossBySource[bucket.id];
    return ceiling === undefined ? balance : Math.max(0, Math.min(balance, ceiling - (drawnGross[bucket.id] ?? 0)));
  };

  const isReachable = (bucket: AccountBucket): boolean =>
    !excluded.has(bucket.id) && isBucketAvailableAtAge(bucket, ageByBucketId.get(bucket.id) ?? 0, scenario.accountAvailabilityAges);

  let netRemaining = Math.max(0, netNeeded);

  /** Draws proportionally across one group of interchangeable accounts until they're spent or the need is met. */
  function drawTier(tier: AccountBucket[]): void {
    for (let pass = 0; pass < TIER_REDISTRIBUTION_PASSES && netRemaining > 0.01; pass++) {
      const live = tier.filter((bucket) => capacityOf(bucket) > 0.01);
      const capacity = live.reduce((sum, bucket) => sum + capacityOf(bucket), 0);
      if (capacity <= 0.01) return;

      // Fixed for the whole pass, so the shares sum to what was wanted rather
      // than each account taking a fraction of an ever-shrinking remainder.
      const wanted = netRemaining;
      const remainingBefore = netRemaining;

      for (const bucket of live) {
        if (netRemaining <= 0.01) break;
        const capped = capacityOf(bucket);
        if (capped <= 0.01) continue;

        const netShare = Math.min(netRemaining, wanted * (capped / capacity));
        const owner = ownerOf(bucket.id);
        const base = baseTaxableIncomeByPersonId.get(owner) ?? 0;
        const ssBenefit = socialSecurityBenefitByPersonId.get(owner) ?? 0;
        const isTaxDeferred = bucket.taxTreatment === 'taxDeferred';
        // A tax-deferred top-up is a real taxable distribution, so it has to
        // come out gross: pulling exactly the net would leave the buffer short
        // by the tax.
        const gross = isTaxDeferred ? grossUpForNet(netShare, base, taxConfig, capped, ssBenefit) : Math.min(capped, netShare);
        if (gross <= 0.01) continue;

        const tax = isTaxDeferred ? incrementalTaxOn(base, gross, taxConfig, ssBenefit) : { federal: 0, stateOrProvincial: 0, total: 0 };
        const netLanded = gross - tax.total;

        balances[bucket.id] -= gross;
        drawnGross[bucket.id] = (drawnGross[bucket.id] ?? 0) + gross;
        netRemaining -= netLanded;

        const result = resultFor(owner);
        result.pulledFrom[bucket.id] = (result.pulledFrom[bucket.id] ?? 0) + gross;
        result.amountTransferred += netLanded;
        if (isTaxDeferred) {
          result.taxableDistribution += gross;
          result.taxOnDistribution = {
            federal: result.taxOnDistribution.federal + tax.federal,
            stateOrProvincial: result.taxOnDistribution.stateOrProvincial + tax.stateOrProvincial,
            total: result.taxOnDistribution.total + tax.total,
          };
          baseTaxableIncomeByPersonId.set(owner, base + gross);
        }
        result.steps.push({
          label: `Replenish cash from ${bucket.label}${isTaxDeferred ? ' (taxable distribution)' : ''}`,
          formula: 'cash shortfall × (this account’s balance ÷ every reachable balance of that kind), grossed up for tax if tax-deferred',
          inputs: { cashShortfall: wanted, bucketBalance: capped, reachableBalanceOfKind: capacity, grossWithdrawn: gross },
          result: netLanded,
          relatedFields: ['cashBufferReplenishment'],
        });
      }

      // Nothing moved despite there being capacity - every account is pinned by
      // its own cap, so further passes would spin.
      if (remainingBefore - netRemaining <= 0.01) return;
    }
  }

  // Meltdown sources first, one at a time: each is capped at its own bracket
  // headroom, and pooling them would let one rule spend another's room.
  for (const bucketId of priority) {
    if (netRemaining <= 0.01) break;
    const bucket = allBuckets.find((b) => b.id === bucketId);
    if (bucket && isReachable(bucket)) drawTier([bucket]);
  }

  const kindsPresent = [...new Set(allBuckets.map((b) => b.kind))];
  const kindOrder = [
    ...scenario.householdWithdrawalOrder.filter((kind) => kindsPresent.includes(kind)),
    ...kindsPresent.filter((kind) => !scenario.householdWithdrawalOrder.includes(kind)),
  ];

  for (const kind of kindOrder) {
    if (netRemaining <= 0.01) break;
    const ofKind = allBuckets.filter((b) => b.kind === kind && !priority.includes(b.id) && isReachable(b));
    // Joint before personal, matching the spending draw: a household spends
    // what it holds together before reaching into anyone's own accounts.
    for (const joint of [true, false]) {
      if (netRemaining <= 0.01) break;
      drawTier(ofKind.filter((b) => jointIds.has(b.id) === joint));
    }
  }

  return results;
}

/**
 * One person's row, once the household-wide spending and tax draws have already
 * run. Handles what is still genuinely personal - their meltdowns, their share
 * of any surplus - and assembles the flows.
 *
 * Tax was computed by the caller. A withdrawal from this person's tax-deferred
 * account is taxable to THEM even when it funded someone else's spending,
 * because that is who the CRA and IRS assess. That attribution is also what
 * keeps `checkLedgerInvariants` satisfied: a draw has to appear on the row of
 * the account it left, or that row's Start and End stop reconciling.
 */
function computePersonRow(
  plan: PersonPlan,
  scenario: Scenario,
  year: number,
  age: number,
  balances: Record<string, number>,
  balancesAtYearStart: Record<string, number>,
  needs: PersonNeeds,
  replenishment: ReplenishmentOutcome,
  taxConfig: TaxConfig,
  share: HouseholdDrawShare,
  taxResult: { federal: number; stateOrProvincial: number; total: number },
  grossTaxableIncome: number,
  surplusToBank: number,
  socialSecurityBenefit: number,
): { draft: DraftLedgerYearRow; warnings: EngineWarning[] } {
  const audit: AuditStep[] = [...needs.audit, ...replenishment.audit, ...share.audit];
  const warnings: EngineWarning[] = [...share.warnings];

  const ownBuckets = plan.accountBuckets;
  const visibleBuckets = [...ownBuckets, ...scenario.sharedAccountBuckets];
  const ownCashBucket = ownBuckets.find((b) => b.isCashBuffer);

  const { isRetired, overriddenFields, incomes, benefits } = needs;
  const retirementStartYear = plan.retirementStartYear;

  // Restricted to this person's visible buckets rather than copied wholesale
  // from the balances map: that map holds EVERY bucket in the scenario, and the
  // ones this person can't see would leak onto their row.
  const accountStart: Record<string, number> = {};
  for (const bucket of visibleBuckets) accountStart[bucket.id] = balancesAtYearStart[bucket.id] ?? 0;

  // Seeded with what cash-buffer replenishment already moved in this year, so
  // the credit side of that transfer is reported alongside the withdrawals that
  // funded it rather than being invisible.
  const contributions: Record<string, number> = { ...replenishment.credits };

  const surplusDestination = visibleBuckets.find((b) => b.id === plan.surplusDestinationAccountBucketId) ?? ownCashBucket;
  if (surplusDestination && surplusToBank > 0.005) {
    balances[surplusDestination.id] += surplusToBank;
    contributions[surplusDestination.id] = (contributions[surplusDestination.id] ?? 0) + surplusToBank;
    audit.push({
      label: `Share of household surplus banked to ${surplusDestination.label}`,
      formula: 'household income - spending - tax, split by each person’s share of that income',
      inputs: { surplusToBank },
      result: surplusToBank,
      relatedFields: [`contributions.${surplusDestination.id}`],
    });
  }

  // Meltdowns stay strictly personal: a meltdown fills one person's own bracket
  // and can only come from their own tax-deferred accounts.
  const meltdownWithdrawals: Record<string, number> = {};
  let meltdownTotalWithdrawn = 0;
  const reinvestmentByDestination: Record<string, number> = {};
  let taxableIncomeWithMeltdowns = grossTaxableIncome;
  for (const rule of plan.meltdownRules) {
    const destination = visibleBuckets.find((b) => b.id === rule.destinationAccountBucketId) ?? surplusDestination;
    if (!destination) continue;

    const result = calculateMeltdownWithdrawal(rule, year, taxableIncomeWithMeltdowns, ownBuckets, balances, age, scenario.accountAvailabilityAges);
    if (result.totalWithdrawn <= 0) continue;
    audit.push(...result.steps);
    for (const [bucketId, amount] of Object.entries(result.withdrawals)) {
      balances[bucketId] -= amount;
      meltdownWithdrawals[bucketId] = (meltdownWithdrawals[bucketId] ?? 0) + amount;
    }
    meltdownTotalWithdrawn += result.totalWithdrawn;
    taxableIncomeWithMeltdowns += result.totalWithdrawn;
    reinvestmentByDestination[destination.id] = (reinvestmentByDestination[destination.id] ?? 0) + result.totalWithdrawn;
  }

  let meltdownTax = { federal: 0, stateOrProvincial: 0, total: 0 };
  if (meltdownTotalWithdrawn > 0) {
    const taxWithMeltdown = calculateTotalTax(grossTaxableIncome + meltdownTotalWithdrawn, taxConfig, socialSecurityBenefit);
    const taxWithoutMeltdown = calculateTotalTax(grossTaxableIncome, taxConfig, socialSecurityBenefit);
    meltdownTax = {
      federal: taxWithMeltdown.federal - taxWithoutMeltdown.federal,
      stateOrProvincial: taxWithMeltdown.stateOrProvincial - taxWithoutMeltdown.stateOrProvincial,
      total: taxWithMeltdown.total - taxWithoutMeltdown.total,
    };
    audit.push({
      label: 'Tax on meltdown withdrawals (incremental)',
      formula: 'calculateTotalTax(grossTaxableIncome + meltdownWithdrawals) - calculateTotalTax(grossTaxableIncome)',
      inputs: { grossTaxableIncome, meltdownWithdrawal: meltdownTotalWithdrawn },
      result: meltdownTax.total,
      relatedFields: ['taxesPaid.total'],
    });

    // A meltdown is self-funding: the cash it pulls out pays its own incremental
    // tax and only the remainder is reinvested. It deliberately does NOT also
    // draw that tax from the household order.
    for (const [destinationId, grossAmount] of Object.entries(reinvestmentByDestination)) {
      if (balances[destinationId] === undefined) continue;
      const shareOfMeltdown = grossAmount / meltdownTotalWithdrawn;
      const reinvestment = Math.max(0, grossAmount - meltdownTax.total * shareOfMeltdown);
      if (reinvestment <= 0) continue;
      balances[destinationId] += reinvestment;
      contributions[destinationId] = (contributions[destinationId] ?? 0) + reinvestment;
      audit.push({
        label: 'Meltdown reinvestment',
        formula: 'meltdownWithdrawal - incrementalTax × (this destination’s share of the meltdown)',
        inputs: { meltdownWithdrawal: grossAmount, incrementalTax: meltdownTax.total * shareOfMeltdown },
        result: reinvestment,
        relatedFields: [`contributions.${destinationId}`],
      });
    }
  }

  const withdrawals: Record<string, number> = {};
  for (const bucket of visibleBuckets) {
    const total = (replenishment.withdrawals[bucket.id] ?? 0) + (share.withdrawals[bucket.id] ?? 0) + (meltdownWithdrawals[bucket.id] ?? 0);
    if (total > 0) withdrawals[bucket.id] = total;
  }

  // What this person actually funded of the household budget: their own income
  // that went toward it, plus what came out of their accounts for it. Summed
  // across the household these come back to the budget exactly, which is what
  // lets combineLedgers keep adding `spendingNominal` up.
  const spendingNominal = share.incomeUsedForSpending + share.spendingWithdrawals;
  const meltdownWithdrawalTotal = Object.values(meltdownWithdrawals).reduce((sum, amount) => sum + amount, 0);

  return {
    warnings,
    draft: {
      year,
      age,
      yearsToOrInRetirement: retirementStartYear !== null ? year - retirementStartYear : Number.NaN,
      isRetired,
      spendingNominal,
      spendingReal: spendingNominal,
      incomes,
      benefits,
      accountStart: pickBucketAmounts(accountStart, visibleBuckets),
      withdrawals: pickBucketAmounts(withdrawals, visibleBuckets),
      contributions: pickBucketAmounts(contributions, visibleBuckets),
      growth: {},
      cashBufferReplenishment: replenishment.cashBufferReplenishment,
      meltdownWithdrawalTotal,
      requiredDistributionTotal: replenishment.requiredDistribution,
      taxesPaid: {
        federal: replenishment.taxesPaid.federal + taxResult.federal + meltdownTax.federal,
        stateOrProvincial: replenishment.taxesPaid.stateOrProvincial + taxResult.stateOrProvincial + meltdownTax.stateOrProvincial,
        total: replenishment.taxesPaid.total + taxResult.total + meltdownTax.total,
      },
      overriddenFields,
      audit: { steps: audit },
    },
  };
}

export interface PersonLedger {
  plan: PersonPlan;
  result: LedgerResult;
}

/** How much cash `cashBuckets` holds between them - the figure a buffer target is measured against. */
function totalCashHeld(cashBuckets: AccountBucket[], balances: Record<string, number>): number {
  return cashBuckets.reduce((sum, bucket) => sum + (balances[bucket.id] ?? 0), 0);
}

/**
 * The source order to replenish this person's cash from, adjusted for any
 * meltdown scheduled this year.
 *
 * In a meltdown year the plan is already committed to pulling a taxed
 * distribution out of that account to fill a tax bracket. Funding the cash
 * buffer from anywhere else would mean liquidating a second account
 * alongside it - typically selling taxable investments - when the money
 * coming out of the meltdown could have covered the need. So the meltdown's
 * source moves to the front of the order.
 *
 * The draw is capped at the bracket headroom the rule is aiming to fill, so
 * a large cash need can't push taxable income past the ceiling the meltdown
 * deliberately set; past that it falls through to the normal order. Nothing
 * is added that the person hasn't already listed as a replenishment source -
 * an account they excluded stays excluded.
 *
 * This doesn't change how much comes out of the account overall: whatever
 * the top-up takes counts toward taxable income, so the meltdown step later
 * in the year sees a smaller remaining headroom and pulls correspondingly
 * less. It only changes which account ends up funding the cash.
 */
function meltdownPriorityFor(
  plan: PersonPlan,
  year: number,
  taxableIncomeSoFar: number,
  isEligible: (bucketId: string) => boolean,
): { priority: string[]; maxGrossBySource: Record<string, number> } {
  const maxGrossBySource: Record<string, number> = {};
  const priority: string[] = [];
  // Rules share one ceiling rather than each filling to it independently -
  // the same running-total treatment the meltdown step itself uses.
  let projectedIncome = taxableIncomeSoFar;

  for (const rule of plan.meltdownRules) {
    if (!rule.enabled) continue;
    if (rule.startYear !== null && year < rule.startYear) continue;
    if (rule.endYear !== null && year > rule.endYear) continue;
    if (!isEligible(rule.accountBucketId) || priority.includes(rule.accountBucketId)) continue;

    const headroom = rule.targetTaxableIncomeCeiling - projectedIncome;
    if (headroom <= 0.01) continue;

    priority.push(rule.accountBucketId);
    maxGrossBySource[rule.accountBucketId] = headroom;
    projectedIncome += headroom;
  }

  return { priority, maxGrossBySource };
}

/** The above, applied to one person's own replenishment order - the per-person buffer mode. */
function replenishmentPlanFor(
  plan: PersonPlan,
  year: number,
  taxableIncomeSoFar: number,
): { replenishmentOrder: string[]; maxGrossBySource: Record<string, number> } {
  const order = plan.cashBufferRule.replenishmentOrder;
  const { priority, maxGrossBySource } = meltdownPriorityFor(plan, year, taxableIncomeSoFar, (id) => order.includes(id));

  if (priority.length === 0) return { replenishmentOrder: order, maxGrossBySource: {} };
  return { replenishmentOrder: [...priority, ...order.filter((id) => !priority.includes(id))], maxGrossBySource };
}

/** A buffer's target amount: the share of a year's spending it's meant to hold. */
function bufferTargetAmount(months: number, spending: number): number {
  return (months / 12) * spending;
}

/**
 * Builds every person's ledger for a scenario, year by year.
 *
 * The year loop is OUTER and the person loop INNER - the opposite of running
 * each person's whole timeline to completion in turn. That's what makes
 * shared accounts work: all persons and all shared buckets share one
 * `balances` map, so when Person 1 draws from the joint account in 2030,
 * Person 2 sees the reduced balance in that same year.
 *
 * Each year runs in five phases, and the order matters:
 *   0. advance inflation, compute every person's needs (spending, income,
 *      benefits - all independent of any withdrawal), decide run order;
 *   1. cash-buffer replenishment - pre-funds the buffer to target BEFORE
 *      anyone's spending draws on it. This runs first specifically to avoid
 *      a race: if replenishment ran after spending (as it used to), whoever
 *      draws from a shared buffer first could exhaust it before a later
 *      person's turn, producing a shortfall in a year the buffer visibly
 *      ends up refilled - confusing, and avoidable by pre-funding instead;
 *   2. each person's own spending/tax/meltdown/surplus-banking, in run
 *      order, with that year's replenishment already folded into their tax;
 *   3. growth for every bucket, personal and shared, exactly once;
 *   4. end-of-year contributions, personal and shared - each one funded out
 *      of cash on hand rather than credited from nowhere (see drawFromCash);
 *   5. finalize each person's row.
 */
export function buildScenarioLedger(scenario: Scenario, overrides: GridOverride[]): PersonLedger[] {
  const startYear = new Date().getFullYear();
  const horizonEndYear = getProjectionHorizonEndYear(scenario.persons);
  const sharedBuckets = scenario.sharedAccountBuckets;

  // The household buffer asks "does the household hold N months of spending
  // in cash", so EVERY cash-flagged account counts toward it - shared or
  // personal - not just the one the top-up is deposited into. A second cash
  // pool sitting on plenty therefore satisfies the target on its own, instead
  // of the plan selling investments to fill one account while cash idles in
  // another. These accounts are also skipped as funding sources, since moving
  // cash between two accounts that both count changes the total by nothing.
  const householdCashBuckets = [...sharedBuckets, ...scenario.persons.flatMap((p) => p.accountBuckets)].filter((b) => b.isCashBuffer);
  const householdCashIds = new Set(householdCashBuckets.map((b) => b.id));

  // One balances map for the whole scenario. Bucket ids are globally unique,
  // so personal and shared buckets coexist without collision.
  // Converted here, once: a US account's balance is entered in USD but every
  // comparison downstream (spending, tax brackets, meltdown ceilings) is in
  // the scenario's currency.
  const balances: Record<string, number> = {};
  for (const person of scenario.persons) {
    for (const bucket of person.accountBuckets) balances[bucket.id] = convertBucketAmountToScenarioCurrency(bucket.startingBalance, bucket, scenario);
  }
  for (const bucket of sharedBuckets) balances[bucket.id] = convertBucketAmountToScenarioCurrency(bucket.startingBalance, bucket, scenario);

  // Cost basis runs alongside `balances`, for taxable accounts only - the gap
  // between the two is unrealized gain, which becomes taxable the moment any
  // of it is sold. Absent an explicit figure the account is assumed to have no
  // embedded gain, which is neutral rather than true; a long-held position with
  // a low basis costs materially more to draw down.
  const costBasis: Record<string, number> = {};
  const allBucketsInScenario = [...sharedBuckets, ...scenario.persons.flatMap((p) => p.accountBuckets)];
  const bucketById = new Map(allBucketsInScenario.map((b) => [b.id, b]));
  for (const bucket of allBucketsInScenario) {
    if (bucket.taxTreatment !== 'taxable') continue;
    costBasis[bucket.id] = convertBucketAmountToScenarioCurrency(bucket.costBasis ?? bucket.startingBalance, bucket, scenario);
  }
  // Zero when the feature is off, which switches off the gain WITHOUT switching
  // off basis consumption - `realizeGain` still reports how much basis a sale
  // used up, so the two stay in step if the toggle is flipped mid-projection.
  const inclusionRatePct = scenario.taxableAccountTaxation.enabled ? scenario.taxableAccountTaxation.capitalGainsInclusionRatePct : 0;

  const states = new Map<string, PersonYearState>();
  const rowsByPerson = new Map<string, LedgerYearRow[]>();
  const warningsByPerson = new Map<string, EngineWarning[]>();
  for (const person of scenario.persons) {
    // Catch up the cumulative inflation factor if retirement already started
    // before the projection window begins, so the first row's nominal
    // spending reflects inflation already accrued since retirementStartYear.
    let cumulativeInflationFactor = 1;
    if (person.retirementStartYear !== null && person.retirementStartYear < startYear) {
      for (let y = person.retirementStartYear + 1; y < startYear; y++) {
        cumulativeInflationFactor *= 1 + getInflationRateForYear(scenario.inflation, y);
      }
    }
    states.set(person.id, {
      cumulativeInflationFactor,
      // Pre-retirement spending is anchored to today's real dollars (the
      // projection's start year), unlike post-retirement spending which is
      // re-anchored to the retirement year above.
      preRetirementInflationFactor: 1,
      // No prior year exists before the first projected year.
      previousYearTaxableIncome: 0,
    });
    rowsByPerson.set(person.id, []);
    warningsByPerson.set(person.id, []);
  }

  // A shared account has no single owner, so its pre/post-retirement rate
  // follows the household: it flips once the EARLIEST-retiring person has
  // retired (the household has begun drawing down), and its own annual
  // contribution keeps running while ANY person is still working.
  const retirementYears = scenario.persons.map((p) => p.retirementStartYear).filter((y): y is number => y !== null);
  const earliestRetirementYear = retirementYears.length > 0 ? Math.min(...retirementYears) : null;
  const allRetiredByYear = (year: number) => scenario.persons.every((p) => p.retirementStartYear !== null && year >= p.retirementStartYear);

  // Both run from 1 in the projection's first year; see their use inside the
  // loop. The household one re-anchors at the earliest retirement, so spending
  // entered "in today's money at retirement" means exactly that.
  let indexationFactor = 1;
  let householdInflationFactor = 1;

  for (let year = startYear; year <= horizonEndYear; year++) {
    // Phase 0: advance inflation, then compute every person's needs up front
    // - none of it depends on a withdrawal outcome - and decide run order.
    // Persons whose income covers their own spending run FIRST in Phase 2,
    // so their surplus reaches a shared account before anyone draws on it;
    // among people who actually draw, `scenario.persons` order is preserved,
    // which is what decides who gets first claim on a shared account.
    // The year's opening position, captured before replenishment or anyone's
    // withdrawal moves a balance. Every person's row reports its `accountStart`
    // from this one snapshot, so a shared bucket reads the same on all of them
    // and each year's Start is exactly the prior year's End.
    const balancesAtYearStart = { ...balances };

    // Every dollar threshold written in today's money - bracket edges, the
    // standard deduction/BPA, the OAS clawback threshold, and any contribution
    // limit flagged to track inflation - is scaled by this. It compounds from
    // 1 in the projection's first year using the same inflation assumption
    // spending does, so a `byYear` override moves thresholds and spending
    // together. Held at 1 when the scenario opts out (see indexTaxConfig).
    if (year > startYear) indexationFactor *= 1 + getInflationRateForYear(scenario.inflation, year);
    const thresholdFactor = scenario.indexTaxThresholdsToInflation ? indexationFactor : 1;
    const taxConfigForYear = indexTaxConfig(scenario.taxConfig, thresholdFactor);
    const oasClawbackThreshold = OAS_CLAWBACK_THRESHOLD_2025 * thresholdFactor;

    for (const person of scenario.persons) {
      advanceInflation(person, scenario, year, startYear, states.get(person.id)!);
    }

    // The household budget flips to its at-retirement figure when the EARLIEST
    // person retires, and re-anchors its inflation there - the same rule a
    // shared account's growth rate follows. Anchoring per person instead would
    // have a staggered household spending less than either figure while one
    // partner is retired and the other isn't.
    const householdIsRetired = earliestRetirementYear !== null && year >= earliestRetirementYear;
    if (householdIsRetired && year === earliestRetirementYear) householdInflationFactor = 1;
    else if (year > startYear) householdInflationFactor *= 1 + getInflationRateForYear(scenario.inflation, year);
    const household = householdSpendingFor(scenario, householdIsRetired, householdInflationFactor, year, overrides);
    // A personal cash buffer is sized in "months of spending", but spending is
    // the household's now and has no per-person figure. An even share is the
    // honest stand-in: each person holds a buffer against their part of one
    // shared budget.
    const perPersonSpendingProxy = household.nominalTotal / scenario.persons.length;

    const needsByPersonId = new Map<string, PersonNeeds>();
    for (const person of scenario.persons) {
      needsByPersonId.set(person.id, computePersonNeeds(person, year, year - person.birthYear, startYear, states.get(person.id)!, overrides, oasClawbackThreshold));
    }

    // This person's US Social Security benefit this year, if any - a fixed
    // constant for the rest of the year's tax calculations (see
    // calculateTotalTax). Zero for a Canadian person, and zero for a US
    // person who hasn't claimed yet, either of which restores the old
    // 100%-taxable behavior exactly.
    const ssBenefitByPersonId = new Map<string, number>();
    for (const person of scenario.persons) {
      const needs = needsByPersonId.get(person.id)!;
      const ssBenefit = needs.benefits.filter((b) => b.type === 'US_SOCIAL_SECURITY').reduce((sum, b) => sum + b.amount, 0);
      ssBenefitByPersonId.set(person.id, ssBenefit);
    }

    // Who owns what, and how old they are this year. Both household-wide
    // passes - the buffer top-up in Phase 1 and the spending draw in Phase 2 -
    // need them, since a draw's age gate follows the account's OWNER and so
    // does the tax it generates.
    const ageByBucketId = new Map<string, number>();
    for (const person of scenario.persons) {
      for (const bucket of person.accountBuckets) ageByBucketId.set(bucket.id, year - person.birthYear);
    }
    // Joint accounts belong to nobody in particular; they are taxable by schema
    // refinement and so never age-gated, but give them the oldest person's age
    // rather than 0 so a gate someone adds by hand still behaves sanely.
    const oldestAge = Math.max(...scenario.persons.map((p) => year - p.birthYear));
    for (const bucket of sharedBuckets) ageByBucketId.set(bucket.id, oldestAge);

    const ownerByBucketId = new Map<string, string>();
    for (const person of scenario.persons) {
      for (const bucket of person.accountBuckets) ownerByBucketId.set(bucket.id, person.id);
    }
    // A joint draw is reported on the primary person's row, the same place
    // shared growth and shared contributions already land, so the debit and the
    // credit for a shared bucket stay on one row.
    const primaryPersonId = scenario.persons[0].id;
    const ownerOf = (bucketId: string) => ownerByBucketId.get(bucketId) ?? primaryPersonId;

    // Phase 0b: what the taxable accounts throw off this year in interest and
    // dividends. Computed on the OPENING balance, before anything is drawn, so
    // it is known in time to price every gross-up and every tax pass below.
    // It is reinvested rather than paid out in cash, so no balance moves - but
    // it has been taxed, so it raises the cost basis by the same amount, which
    // is exactly what stops it being taxed a second time as a capital gain on
    // the way out.
    const distributionIncomeByPersonId = new Map<string, number>();
    for (const person of scenario.persons) distributionIncomeByPersonId.set(person.id, 0);

    // Only matters for cash accounts, whose yield IS the return rate and so
    // differs before and after retirement. A shared account follows the
    // household, matching how its growth is applied in Phase 3.
    const sharedIsRetiredThisYear = earliestRetirementYear !== null && year >= earliestRetirementYear;
    const isRetiredFor = (bucketId: string): boolean => {
      const person = scenario.persons.find((p) => p.id === ownerByBucketId.get(bucketId));
      if (!person) return sharedIsRetiredThisYear;
      return person.retirementStartYear !== null && year >= person.retirementStartYear;
    };

    for (const bucket of allBucketsInScenario) {
      const yieldPct = distributionYieldPctFor(bucket, scenario, isRetiredFor(bucket.id));
      if (yieldPct <= 0) continue;
      const distribution = Math.max(0, balancesAtYearStart[bucket.id] ?? 0) * (yieldPct / 100);
      if (distribution <= 0.005) continue;
      costBasis[bucket.id] = (costBasis[bucket.id] ?? 0) + distribution;
      const owner = ownerOf(bucket.id);
      distributionIncomeByPersonId.set(owner, (distributionIncomeByPersonId.get(owner) ?? 0) + distribution);
    }

    // Phase 1: cash-buffer replenishment, BEFORE anyone's spending draws
    // compete for the same pot. Priced against each person's pre-withdrawal
    // taxable income (income + benefits) - a reasonable base since those
    // don't depend on any withdrawal decision, unlike spending-driven
    // withdrawals which haven't happened yet at this point.
    const replenishmentByPersonId = new Map<string, ReplenishmentOutcome>();
    const replenishmentBaseByPersonId = new Map<string, number>();
    for (const person of scenario.persons) {
      replenishmentByPersonId.set(person.id, emptyReplenishmentOutcome());
      const needs = needsByPersonId.get(person.id)!;
      replenishmentBaseByPersonId.set(person.id, needs.totalIncomes + needs.totalBenefits + (distributionIncomeByPersonId.get(person.id) ?? 0));
    }

    const sharedRule = scenario.sharedCashBufferRule;
    const sharedCashBucket = sharedBuckets.find((b) => b.id === sharedRule?.targetAccountBucketId);
    const totalSpendingAll = household.nominalTotal;

    /**
     * The cash buffer this person's money would top up, and how far below
     * target it currently sits - expressed in that account's own currency.
     * Null when they have no buffer to fill.
     */
    function bufferShortfallFor(person: PersonPlan): { bucket: AccountBucket; shortfall: number } | null {
      if (sharedRule?.enabled && sharedCashBucket) {
        const target = bufferTargetAmount(sharedRule.targetMonthsOfSpending, totalSpendingAll);
        return { bucket: sharedCashBucket, shortfall: Math.max(0, target - totalCashHeld(householdCashBuckets, balances)) };
      }
      const ownCash = person.accountBuckets.filter((b) => b.isCashBuffer);
      const bucket = ownCash[0];
      if (!bucket || !person.cashBufferRule.enabled) return null;
      const target = bufferTargetAmount(person.cashBufferRule.targetMonthsOfSpending, perPersonSpendingProxy);
      return { bucket, shortfall: Math.max(0, target - totalCashHeld(ownCash, balances)) };
    }

    // Phase 1a: statutory minimum distributions - US RMDs and Canadian RRIF
    // minimums. These leave the account whether the plan wants the money or
    // not, so they run BEFORE the buffer top-up: the proceeds cover the cash
    // need first and only the remainder is reinvested. Every dollar of cash
    // need they cover is an investment the top-up doesn't have to sell.
    for (const person of scenario.persons) {
      const rule = person.requiredDistributionRule ?? DEFAULT_REQUIRED_DISTRIBUTION_RULE;
      if (!rule.enabled) continue;

      const visibleBuckets = [...person.accountBuckets, ...sharedBuckets];
      // Resolved before withdrawing: a distribution with nowhere to land would
      // otherwise be taxed and then vanish from the ledger.
      const destination =
        visibleBuckets.find((b) => b.id === rule.destinationAccountBucketId) ??
        visibleBuckets.find((b) => b.id === person.surplusDestinationAccountBucketId) ??
        person.accountBuckets.find((b) => b.isCashBuffer) ??
        person.accountBuckets.find((b) => b.taxTreatment === 'taxable');
      if (!destination) continue;

      const age = year - person.birthYear;
      const required = calculateRequiredDistributions(
        person.accountBuckets,
        balancesAtYearStart,
        balances,
        person.birthYear,
        age,
        rule.startAgeOverride,
        scenario.accountAvailabilityAges,
      );
      if (required.totalWithdrawn <= 0.01) continue;

      const outcome = replenishmentByPersonId.get(person.id)!;
      const base = replenishmentBaseByPersonId.get(person.id)!;
      // Self-funding, exactly like a meltdown: the distribution pays its own
      // incremental tax and only the remainder is available to deposit, so
      // the tax isn't also drawn from the spending waterfall later.
      const ssBenefit = ssBenefitByPersonId.get(person.id) ?? 0;
      const withDistribution = calculateTotalTax(base + required.totalWithdrawn, taxConfigForYear, ssBenefit);
      const without = calculateTotalTax(base, taxConfigForYear, ssBenefit);
      const tax = {
        federal: withDistribution.federal - without.federal,
        stateOrProvincial: withDistribution.stateOrProvincial - without.stateOrProvincial,
        total: withDistribution.total - without.total,
      };

      for (const [bucketId, amount] of Object.entries(required.withdrawals)) {
        balances[bucketId] -= amount;
        outcome.withdrawals[bucketId] = (outcome.withdrawals[bucketId] ?? 0) + amount;
        outcome.requiredDistribution += amount;
      }
      outcome.taxableDistribution += required.totalWithdrawn;
      outcome.taxesPaid = {
        federal: outcome.taxesPaid.federal + tax.federal,
        stateOrProvincial: outcome.taxesPaid.stateOrProvincial + tax.stateOrProvincial,
        total: outcome.taxesPaid.total + tax.total,
      };
      outcome.audit.push(...required.steps);
      // Raises the base every later gross-up and the meltdown ceiling are
      // priced against, so the forced income is never counted twice.
      replenishmentBaseByPersonId.set(person.id, base + required.totalWithdrawn);

      const buffer = bufferShortfallFor(person);
      let bufferRoom = buffer?.shortfall ?? 0;

      for (const gross of Object.values(required.withdrawals)) {
        // Tax apportioned by each account's share of the total, so two
        // accounts distributing at once each carry their own part of it.
        const afterTax = gross - tax.total * (gross / required.totalWithdrawn);
        let remaining = afterTax;
        if (remaining <= 0) continue;

        if (buffer && bufferRoom > 0.01) {
          const landed = Math.min(remaining, bufferRoom);
          balances[buffer.bucket.id] += landed;
          outcome.credits[buffer.bucket.id] = (outcome.credits[buffer.bucket.id] ?? 0) + landed;
          outcome.cashBufferReplenishment += landed;
          bufferRoom -= landed;
          remaining -= landed;
          outcome.audit.push({
            label: `Required distribution routed to ${buffer.bucket.label}`,
            formula: 'min(distribution after tax, cash buffer shortfall)',
            inputs: { distributionAfterTax: afterTax, bufferShortfall: buffer.shortfall },
            result: landed,
            relatedFields: ['cashBufferReplenishment'],
          });
        }

        if (remaining > 0.01) {
          balances[destination.id] += remaining;
          outcome.credits[destination.id] = (outcome.credits[destination.id] ?? 0) + remaining;
          outcome.audit.push({
            label: `Required distribution surplus reinvested into ${destination.label}`,
            formula: 'distribution after tax, less whatever the cash buffer needed',
            inputs: { remainingAfterBuffer: remaining },
            result: remaining,
            relatedFields: [`contributions.${destination.id}`],
          });
        }
      }
    }

    if (sharedRule?.enabled && sharedCashBucket) {
      // Household mode: one buffer, sized against TOTAL spending and funded
      // from the household's accounts as a whole in the scenario's kind order.
      // Measured against the household's cash as a whole, so a flush second
      // cash account counts and no top-up is needed at all.
      const targetAmount = bufferTargetAmount(sharedRule.targetMonthsOfSpending, totalSpendingAll);
      const shortfall = Math.max(0, targetAmount - totalCashHeld(householdCashBuckets, balances));

      if (shortfall > 0.01 && totalSpendingAll > 0) {
        // Household cash can't fund its own target: moving money between two
        // accounts that both count toward it leaves the shortfall exactly
        // where it was. Past that, an account its owner left out of their
        // replenishment order stays out - that list is still the way to keep
        // an account off limits, it just no longer decides the order.
        const excluded = new Set(householdCashIds);
        const listedAsSource = new Set(scenario.persons.flatMap((p) => p.cashBufferRule.replenishmentOrder));
        for (const bucket of [...sharedBuckets, ...scenario.persons.flatMap((p) => p.accountBuckets)]) {
          if (!listedAsSource.has(bucket.id)) excluded.add(bucket.id);
        }

        // Each person's own meltdown sources still lead, capped at the bracket
        // headroom their rule is aiming to fill - see meltdownPriorityFor.
        const priority: string[] = [];
        const maxGrossBySource: Record<string, number> = {};
        for (const person of scenario.persons) {
          const plan = meltdownPriorityFor(person, year, replenishmentBaseByPersonId.get(person.id)!, (id) => !excluded.has(id));
          priority.push(...plan.priority);
          Object.assign(maxGrossBySource, plan.maxGrossBySource);
        }

        const resultsByPersonId = replenishHouseholdWide(shortfall, {
          scenario,
          balances,
          ageByBucketId,
          ownerOf,
          baseTaxableIncomeByPersonId: replenishmentBaseByPersonId,
          socialSecurityBenefitByPersonId: ssBenefitByPersonId,
          taxConfig: taxConfigForYear,
          excluded,
          priority,
          maxGrossBySource,
        });

        // The draws already came out of `balances`; only the credit side is
        // left, and it lands in one account no matter whose money funded it.
        for (const [personId, result] of resultsByPersonId) {
          balances[sharedCashBucket.id] += result.amountTransferred;
          accumulateReplenishment(replenishmentByPersonId.get(personId)!, result, sharedCashBucket);
        }
      }
    } else {
      // Per-person mode: each person tops up their own cash, age-gated and
      // taxed on tax-deferred sources. Same "total cash" measure as the
      // household rule, but scoped to the accounts this rule governs - the
      // person's OWN cash. Shared cash deliberately isn't counted here, and
      // so stays available as a source: moving it into a personal buffer
      // genuinely does raise the total being measured.
      for (const person of scenario.persons) {
        const ownCashBuckets = person.accountBuckets.filter((b) => b.isCashBuffer);
        const ownCashBucket = ownCashBuckets[0];
        if (!ownCashBucket) continue;
        const result = checkAndReplenish(
          balances,
          ownCashBucket.id,
          person.cashBufferRule,
          perPersonSpendingProxy,
          [...person.accountBuckets, ...sharedBuckets],
          year - person.birthYear,
          replenishmentBaseByPersonId.get(person.id)!,
          taxConfigForYear,
          {
            availableCash: totalCashHeld(ownCashBuckets, balances),
            countedTowardTarget: new Set(ownCashBuckets.map((b) => b.id)),
            availabilityAges: scenario.accountAvailabilityAges,
            socialSecurityBenefit: ssBenefitByPersonId.get(person.id),
            ...replenishmentPlanFor(person, year, replenishmentBaseByPersonId.get(person.id)!),
          },
        );
        for (const [bucketId, amount] of Object.entries(result.pulledFrom)) balances[bucketId] -= amount;
        balances[ownCashBucket.id] += result.amountTransferred;
        accumulateReplenishment(replenishmentByPersonId.get(person.id)!, result, ownCashBucket);
      }
    }

    // Phase 1c: give this year's Phase-1 credits their cost basis NOW, before
    // the gain pass below runs.
    //
    // Money routed into a taxable account during Phase 1 - a required
    // distribution's proceeds, a cash-buffer top-up - arrives at par and
    // carries basis equal to itself. Adding that basis only at year end (Phase
    // 4b, where it used to happen) left the gain pass measuring the year's
    // sales against the OPENING balance alone. An account credited mid-year and
    // then drawn down by more than it opened with therefore showed the excess
    // as pure appreciation: a cash account, which cannot appreciate at all, was
    // charged capital gains tax on required-distribution proceeds that had
    // already been taxed in full as ordinary income on the way out of the
    // registered account.
    const basisCreditedInPhase1: Record<string, number> = {};
    for (const person of scenario.persons) {
      for (const [bucketId, amount] of Object.entries(replenishmentByPersonId.get(person.id)!.credits)) {
        if (bucketById.get(bucketId)?.taxTreatment !== 'taxable') continue;
        costBasis[bucketId] = (costBasis[bucketId] ?? 0) + amount;
        basisCreditedInPhase1[bucketId] = (basisCreditedInPhase1[bucketId] ?? 0) + amount;
      }
    }
    /** What an account was worth when this year's sales came out of it: its opening value plus anything Phase 1 already put in. */
    const saleReferenceValue = (bucketId: string) => Math.max(0, balancesAtYearStart[bucketId] ?? 0) + (basisCreditedInPhase1[bucketId] ?? 0);

    // Phase 2: the household's spending and tax, funded from ONE ordered pass
    // over every account, then assembled into per-person rows.
    //
    // Three sub-passes, because they genuinely depend on each other: a draw
    // creates taxable income for whoever OWNS the account, so nobody's tax can
    // be computed until every draw is known, and the tax bill can't be funded
    // until it has been computed. Splitting it this way also removes the old
    // dependency on which person ran first - there is no longer a race for a
    // shared account, because there is only one draw.
    const sharesByPersonId = new Map<string, HouseholdDrawShare>();
    for (const person of scenario.persons) {
      sharesByPersonId.set(person.id, { withdrawals: {}, spendingWithdrawals: 0, incomeUsedForSpending: 0, audit: [], warnings: [] });
    }
    const recordDraw = (result: { withdrawals: Record<string, number>; steps: AuditStep[]; warning?: EngineWarning }, fundsSpending: boolean) => {
      for (const [bucketId, amount] of Object.entries(result.withdrawals)) {
        const share = sharesByPersonId.get(ownerOf(bucketId))!;
        share.withdrawals[bucketId] = (share.withdrawals[bucketId] ?? 0) + amount;
        if (fundsSpending) share.spendingWithdrawals += amount;
      }
      // Audit and any shortfall are the household's, so they go on the primary
      // row once rather than being repeated for everyone.
      const primaryShare = sharesByPersonId.get(primaryPersonId)!;
      primaryShare.audit.push(...result.steps);
      if (result.warning) primaryShare.warnings.push(result.warning);
    };

    // --- 2a: fund the household's spending ---
    const householdIncome = scenario.persons.reduce((sum, p) => {
      const needs = needsByPersonId.get(p.id)!;
      return sum + needs.totalIncomes + needs.totalBenefits;
    }, 0);
    const householdSpending = household.nominalTotal;
    const netSpendingNeed = Math.max(0, householdSpending - householdIncome);
    recordDraw(drawHouseholdWide(netSpendingNeed, scenario, balances, year, ageByBucketId), true);

    // Income covers the budget before any account is touched, so each person's
    // contribution is their share of whatever the budget actually consumed.
    const incomeUsedForSpending = Math.min(householdIncome, householdSpending);
    for (const person of scenario.persons) {
      const needs = needsByPersonId.get(person.id)!;
      const own = needs.totalIncomes + needs.totalBenefits;
      sharesByPersonId.get(person.id)!.incomeUsedForSpending = householdIncome > 0 ? incomeUsedForSpending * (own / householdIncome) : 0;
    }

    // --- 2b: each person's tax, on their OWN income and their OWN accounts ---
    const taxByPersonId = new Map<string, { federal: number; stateOrProvincial: number; total: number }>();
    const grossTaxableByPersonId = new Map<string, number>();
    for (const person of scenario.persons) {
      const needs = needsByPersonId.get(person.id)!;
      const replenishment = replenishmentByPersonId.get(person.id)!;
      const share = sharesByPersonId.get(person.id)!;

      // Only tax-deferred draws are taxable, and shared buckets can never be
      // tax-deferred, so this is exactly this person's own registered accounts -
      // which is who the CRA and IRS assess, regardless of whose spending the
      // money went on.
      const taxableWithdrawals = person.accountBuckets
        .filter((b) => b.taxTreatment === 'taxDeferred')
        .reduce((sum, b) => sum + (share.withdrawals[b.id] ?? 0), 0);

      // Selling a non-registered holding realizes part of its embedded gain,
      // and the included portion of that gain is ordinary taxable income.
      // Measured against the OPENING balance and basis, so every sale this year
      // is priced against the same reference regardless of what order the
      // passes ran in. Draws made later than this point - the tax-funding pass
      // and meltdowns - still consume basis at year end, but their own gain
      // goes uncharged, the same approximation the tax draw already carries.
      let realizedGains = 0;
      for (const bucket of [...person.accountBuckets, ...(person.id === primaryPersonId ? sharedBuckets : [])]) {
        if (bucket.taxTreatment !== 'taxable') continue;
        const sold = (share.withdrawals[bucket.id] ?? 0) + (replenishment.withdrawals[bucket.id] ?? 0);
        const { taxableGain } = realizeGain(sold, saleReferenceValue(bucket.id), costBasis[bucket.id] ?? 0, inclusionRatePct);
        realizedGains += taxableGain;
      }
      if ((distributionIncomeByPersonId.get(person.id) ?? 0) > 0.005) {
        share.audit.push({
          label: 'Interest and dividends from non-registered accounts',
          formula: 'Σ per account of openingBalance × distribution yield (a cash account distributes its whole return)',
          inputs: { investmentYieldPct: scenario.taxableAccountTaxation.annualDistributionYieldPct },
          result: distributionIncomeByPersonId.get(person.id)!,
          relatedFields: ['taxesPaid.total'],
        });
      }
      if (realizedGains > 0.005) {
        share.audit.push({
          label: 'Taxable capital gain realized on non-registered withdrawals',
          formula: 'Σ per account of soldAmount × (1 - costBasis ÷ marketValue) × inclusionRate',
          inputs: { inclusionRatePct },
          result: realizedGains,
          relatedFields: ['taxesPaid.total'],
        });
      }

      const distributionIncome = distributionIncomeByPersonId.get(person.id) ?? 0;
      const grossTaxableIncome =
        taxableWithdrawals + needs.totalIncomes + needs.totalBenefits + replenishment.taxableDistribution + distributionIncome + realizedGains;
      grossTaxableByPersonId.set(person.id, grossTaxableIncome);

      // Replenishment already self-funded and charged tax on its own slice,
      // priced as incremental on top of income+benefits alone. What's left is
      // the full year's tax minus that - which telescopes to the marginal tax
      // on this person's draws at the bracket replenishment already reached.
      const ssBenefit = ssBenefitByPersonId.get(person.id) ?? 0;
      let taxResult: { federal: number; stateOrProvincial: number; total: number };
      if (replenishment.taxableDistribution > 0) {
        const fullYearTax = calculateTotalTax(grossTaxableIncome, taxConfigForYear, ssBenefit);
        taxResult = {
          federal: fullYearTax.federal - replenishment.taxesPaid.federal,
          stateOrProvincial: fullYearTax.stateOrProvincial - replenishment.taxesPaid.stateOrProvincial,
          total: fullYearTax.total - replenishment.taxesPaid.total,
        };
        share.audit.push({
          label: "Tax on this year's income and withdrawals (net of cash-buffer replenishment already taxed)",
          formula: 'calculateTotalTax(grossTaxableIncome) - taxAlreadyChargedOnReplenishment',
          inputs: { grossTaxableIncome, taxAlreadyChargedOnReplenishment: replenishment.taxesPaid.total },
          result: fullYearTax.total - replenishment.taxesPaid.total,
          relatedFields: ['taxesPaid.federal', 'taxesPaid.stateOrProvincial', 'taxesPaid.total'],
        });
      } else {
        const computed = calculateTotalTax(grossTaxableIncome, taxConfigForYear, ssBenefit);
        taxResult = { federal: computed.federal, stateOrProvincial: computed.stateOrProvincial, total: computed.total };
        share.audit.push(...computed.steps);
      }
      taxByPersonId.set(person.id, taxResult);
    }

    // --- 2c: fund the household's tax bill, then bank what's left ---
    const householdTax = scenario.persons.reduce((sum, p) => sum + taxByPersonId.get(p.id)!.total, 0);
    const householdSurplusPreTax = Math.max(0, householdIncome - householdSpending);
    const taxFundedByIncome = Math.max(0, Math.min(householdSurplusPreTax, householdTax));
    // Carried over from the per-person engine: the tax draw is not itself
    // re-taxed. Under pooling that untaxed draw may come from a different
    // person's account than the one whose tax it pays - the same approximation,
    // just spread across the household.
    recordDraw(drawHouseholdWide(householdTax - taxFundedByIncome, scenario, balances, year, ageByBucketId), false);

    const householdSurplusAfterTax = Math.max(0, householdIncome - householdSpending - householdTax);

    // --- 2d: assemble each person's row ---
    const draftsByPersonId = new Map<string, DraftLedgerYearRow>();
    for (const person of scenario.persons) {
      const needs = needsByPersonId.get(person.id)!;
      const own = needs.totalIncomes + needs.totalBenefits;
      const surplusToBank = householdIncome > 0 ? householdSurplusAfterTax * (own / householdIncome) : 0;

      const { draft, warnings } = computePersonRow(
        person,
        scenario,
        year,
        year - person.birthYear,
        balances,
        balancesAtYearStart,
        needs,
        replenishmentByPersonId.get(person.id)!,
        taxConfigForYear,
        sharesByPersonId.get(person.id)!,
        taxByPersonId.get(person.id)!,
        grossTaxableByPersonId.get(person.id)!,
        surplusToBank,
        ssBenefitByPersonId.get(person.id) ?? 0,
      );
      warningsByPerson.get(person.id)!.push(...warnings);
      draftsByPersonId.set(person.id, draft);

      // Set only now that meltdowns have run. A meltdown deliberately generates
      // large taxable income, so it is exactly the thing next year's OAS
      // clawback should be tested against - leaving it out (as this did while
      // the assignment sat in pass 2b) understated the clawback and so
      // overstated OAS for anyone melting down through their OAS years.
      states.get(person.id)!.previousYearTaxableIncome = grossTaxableByPersonId.get(person.id)! + draft.meltdownWithdrawalTotal;
    }
    const drafts = scenario.persons.map((person) => ({ person, draft: draftsByPersonId.get(person.id)! }));

    // Phase 3: growth for every bucket - personal and shared - exactly once.
    // Kept in one flat map as well, because Phase 4 has to know how much of a
    // cash balance is this year's growth before it spends any of it.
    const sharedIsRetired = earliestRetirementYear !== null && year >= earliestRetirementYear;
    const growthThisYear: Record<string, number> = {};
    for (const { person, draft } of drafts) {
      for (const bucket of person.accountBuckets) {
        const ratePct = returnRatePctFor(bucket, scenario.returnRates, draft.isRetired);
        const { newBalance, growthAmount, steps } = applyGrowth(balances[bucket.id], ratePct, bucket.label);
        draft.audit.steps.push(...steps);
        balances[bucket.id] = newBalance;
        draft.growth[bucket.id] = growthAmount;
        growthThisYear[bucket.id] = growthAmount;
      }
    }
    const sharedGrowth: Record<string, number> = {};
    const sharedContributions: Record<string, number> = {};
    for (const bucket of sharedBuckets) {
      const ratePct = returnRatePctFor(bucket, scenario.returnRates, sharedIsRetired);
      const { newBalance, growthAmount } = applyGrowth(balances[bucket.id], ratePct, bucket.label);
      balances[bucket.id] = newBalance;
      sharedGrowth[bucket.id] = growthAmount;
      growthThisYear[bucket.id] = growthAmount;
    }

    // Phase 4: end-of-year contributions, personal and shared. They stop at
    // retirement account by account rather than person by person, since the
    // accounts that keep taking them are a property of the account.
    // Every one of them is FUNDED out of what the household actually holds -
    // its cash first, then its taxable investments - see
    // contributionFundingSources. Persons draw in scenario order, so a shared
    // account funds them first-come-first-served, the same rule spending
    // withdrawals follow.
    const sharedCashSources = sharedBuckets.filter((b) => b.isCashBuffer);
    const sharedFundingWithdrawals: Record<string, number> = {};
    // Every credit made this year, so no account can fund a contribution out
    // of one it just received. Shared across persons deliberately: the circle
    // is just as empty if it runs through two people's accounts.
    const creditedThisYear: Record<string, number> = {};
    for (const { person, draft } of drafts) {
      const cashSources = contributionFundingSources(person, scenario, sharedBuckets);
      let unfunded = 0;
      for (const bucket of person.accountBuckets) {
        // Retiring stops a contribution unless this account is one that keeps
        // taking them - a TFSA, typically. See AccountBucketSchema.
        if (draft.isRetired && !bucket.contributeInRetirement) continue;
        // Indexed and rounded in the account's own currency (a legislated
        // limit is a native-currency figure), then converted like its balance.
        const amount = convertBucketAmountToScenarioCurrency(indexedContributionAmount(bucket, indexationFactor), bucket, scenario);
        if (amount <= 0) continue;
        // An account never funds a contribution into itself - that moves
        // nothing - though one cash account may still fund another.
        const funded = drawFromCash(
          amount,
          cashSources.filter((source) => source.id !== bucket.id),
          balances,
          growthThisYear,
          creditedThisYear,
          (bucketId: string, taken: number) => {
            draft.withdrawals[bucketId] = (draft.withdrawals[bucketId] ?? 0) + taken;
          },
        );
        unfunded += amount - funded;
        if (funded <= 0.01) continue;
        balances[bucket.id] += funded;
        creditedThisYear[bucket.id] = (creditedThisYear[bucket.id] ?? 0) + funded;
        draft.contributions[bucket.id] = (draft.contributions[bucket.id] ?? 0) + funded;
      }
      if (unfunded > 0.01) {
        warningsByPerson.get(person.id)!.push({
          year,
          message: `Contributions short by ${unfunded.toFixed(2)}: the household had no cash or taxable investments left to fund them.`,
        });
      }
    }
    for (const bucket of sharedBuckets) {
      const contribution = convertBucketAmountToScenarioCurrency(indexedContributionAmount(bucket, indexationFactor), bucket, scenario);
      // A shared account keeps contributing while ANY owner still works, so
      // it only stops once the whole household has retired - and not even then
      // if it's flagged to carry on.
      if (contribution <= 0 || (allRetiredByYear(year) && !bucket.contributeInRetirement)) continue;
      // A shared account's own contribution belongs to the household, so it's
      // funded from shared cash and reported on the primary person's row -
      // the same place its growth lands, so the combined view can't
      // double-count either of them.
      const funded = drawFromCash(
        contribution,
        // Shared money only: a joint account's own contribution is the
        // household's, and pulling it out of one person's holdings would put
        // the debit on a row the credit never reaches.
        [...sharedCashSources, ...sharedBuckets.filter((b) => !b.isCashBuffer && b.taxTreatment === 'taxable')].filter((source) => source.id !== bucket.id),
        balances,
        growthThisYear,
        creditedThisYear,
        (bucketId: string, taken: number) => {
          sharedFundingWithdrawals[bucketId] = (sharedFundingWithdrawals[bucketId] ?? 0) + taken;
        },
      );
      if (funded > 0.01) {
        balances[bucket.id] += funded;
        creditedThisYear[bucket.id] = (creditedThisYear[bucket.id] ?? 0) + funded;
        sharedContributions[bucket.id] = (sharedContributions[bucket.id] ?? 0) + funded;
      }
      if (contribution - funded > 0.01) {
        warningsByPerson.get(scenario.persons[0].id)!.push({
          year,
          message: `${bucket.label} contribution short by ${(contribution - funded).toFixed(2)}: shared cash couldn't cover it.`,
        });
      }
    }

    // Phase 4b: settle cost basis, now that every sale and purchase for the
    // year is known. Sales consume basis in proportion to what fraction of the
    // account was basis when they came out - the same reference the gain was
    // charged against in pass 2b, so the two can't drift apart. Purchases add
    // to basis dollar for dollar.
    //
    // Distributions were already added in Phase 0b, and Phase 1's credits in
    // Phase 1c, which is what keeps both from being taxed twice: once as income
    // when earned or distributed, and again as a capital gain when the units
    // they bought are eventually sold. Only what Phase 4 itself contributed is
    // still owed basis here.
    for (const bucket of allBucketsInScenario) {
      if (bucket.taxTreatment !== 'taxable') continue;
      const sold = scenario.persons.reduce((sum, p) => sum + (draftsByPersonId.get(p.id)!.withdrawals[bucket.id] ?? 0), 0) + (sharedFundingWithdrawals[bucket.id] ?? 0);
      const bought =
        scenario.persons.reduce((sum, p) => sum + (draftsByPersonId.get(p.id)!.contributions[bucket.id] ?? 0), 0) +
        (sharedContributions[bucket.id] ?? 0) -
        (basisCreditedInPhase1[bucket.id] ?? 0);

      if (sold > 0.005) {
        const { basisConsumed } = realizeGain(sold, saleReferenceValue(bucket.id), costBasis[bucket.id] ?? 0, inclusionRatePct);
        costBasis[bucket.id] = Math.max(0, (costBasis[bucket.id] ?? 0) - basisConsumed);
      }
      if (bought > 0.005) costBasis[bucket.id] = (costBasis[bucket.id] ?? 0) + bought;
      // Basis can never exceed what the account is actually worth: the excess
      // would be an unrealizable loss, and carrying it forward would shelter
      // gains that a real return path never produced.
      costBasis[bucket.id] = Math.min(costBasis[bucket.id] ?? 0, Math.max(0, balances[bucket.id] ?? 0));
    }

    // Phase 5: finalize rows now that every balance is settled for the year.
    drafts.forEach(({ person, draft }, personIndex) => {
      const visibleBuckets = [...person.accountBuckets, ...sharedBuckets];
      const isPrimary = personIndex === 0;
      const visibleBalances: Record<string, number> = {};
      for (const bucket of visibleBuckets) visibleBalances[bucket.id] = balances[bucket.id];

      const accountEnd = visibleBalances;
      // A person's net worth counts their OWN accounts only - a shared
      // balance isn't theirs to claim, and combineLedgers adds it once.
      const totalNetWorth = person.accountBuckets.reduce((sum, b) => sum + (accountEnd[b.id] ?? 0), 0);

      // Shared growth/contributions land on the primary person's row only, so
      // the combined view (which sums flow records) can't double-count them -
      // and so does the cash draw that paid for those contributions, or the
      // row would report the credit without the debit that funded it.
      const growth = pickBucketAmounts(draft.growth, visibleBuckets);
      const contributions = pickBucketAmounts(draft.contributions, visibleBuckets);
      const withdrawals = pickBucketAmounts(draft.withdrawals, visibleBuckets);

      rowsByPerson.get(person.id)!.push({
        ...draft,
        withdrawals: isPrimary ? mergeSums(withdrawals, sharedFundingWithdrawals) : withdrawals,
        contributions: isPrimary ? mergeSums(contributions, sharedContributions) : contributions,
        growth: isPrimary ? { ...growth, ...sharedGrowth } : growth,
        accountEnd,
        totalNetWorth,
      });
    });
  }

  return scenario.persons.map((person) => ({
    plan: person,
    result: { rows: rowsByPerson.get(person.id)!, warnings: warningsByPerson.get(person.id)! },
  }));
}

/**
 * Where an end-of-year contribution can be funded from, in order: the
 * household's cash first, then investments, in the scenario's withdrawal-kind
 * order.
 *
 * Cash alone was too narrow. Funding a TFSA top-up is exactly the move a
 * retiree makes by SELLING a non-registered holding - shifting money from a
 * taxable account into a tax-free one - and restricting it to cash reported
 * "contributions short" while the household sat on millions in investments.
 * Worse, it made the shortfall a function of the buffer size, so shrinking the
 * cash buffer looked like it broke the plan when nothing about the plan had
 * changed.
 *
 * Only TAXABLE accounts back up the cash. A tax-deferred sale would generate
 * income at a point in the year where tax has already been computed, so it
 * would go uncharged; a tax-free one would move money from one tax-free
 * account to another and accomplish nothing. Sources are limited to what this
 * person can be recorded as drawing - their own accounts and shared ones -
 * since a withdrawal has to appear on the row of the account it left.
 *
 * The capital gain such a sale realizes is not charged in the year it happens,
 * for the same reason: the tax pass is behind us. It is not lost, though - the
 * sale still consumes cost basis in Phase 4b, so the gain surfaces on whatever
 * is sold next.
 */
function contributionFundingSources(person: PersonPlan, scenario: Scenario, sharedBuckets: AccountBucket[]): AccountBucket[] {
  const reachable = [...person.accountBuckets, ...sharedBuckets];
  const cash = reachable.filter((b) => b.isCashBuffer);
  const investments = reachable.filter((b) => !b.isCashBuffer && b.taxTreatment === 'taxable');

  const byKind = scenario.householdWithdrawalOrder;
  const rank = (bucket: AccountBucket) => {
    const index = byKind.indexOf(bucket.kind);
    // A kind left out of the spending order is still reachable here, last -
    // omitting it means "don't spend this down", not "this money isn't there".
    return index === -1 ? byKind.length : index;
  };

  return [...cash, ...investments.sort((a, b) => rank(a) - rank(b))];
}

/**
 * Pays for an end-of-year contribution out of what the household actually
 * holds, drawing `sources` in order and reporting what it raised.
 *
 * A contribution used to be a bare credit - the destination gained the money
 * and no account gave it up. That minted money twice over: a person WITH
 * income already had their surplus banked (Step 2b) and then got the
 * contribution credited on top of it, and a person with NO income grew their
 * net worth every year out of nothing at all, even with the household's cash
 * sitting untouched beside them. Routing it through cash settles both: income
 * reaches these accounts by way of surplus banking, so an earner funds their
 * own contributions, and a single-earner household funds the non-earner's out
 * of the shared cash - which is what such a household actually does.
 *
 * `growthThisYear` is held back rather than spent. The rest of the engine
 * treats a year's growth as arriving at the close - `checkLedgerInvariants`
 * allows a withdrawal only up to Start + Contribution - so a source's
 * balance less its growth is exactly the room it has, and spending past that
 * would leave the row failing its own conservation check. The `min` also
 * covers a negative return, where growth adding room would be nonsense.
 *
 * `creditedThisYear` is held back for a different reason: an account that has
 * just received a contribution must not turn round and fund the next one.
 * Nothing is gained by it - the money goes in a circle and comes back out -
 * but both legs are reported, which inflates the year's contributions without
 * the household being a dollar better off.
 */
function drawFromCash(
  wanted: number,
  sources: AccountBucket[],
  balances: Record<string, number>,
  growthThisYear: Record<string, number>,
  creditedThisYear: Record<string, number>,
  record: (bucketId: string, amount: number) => void,
): number {
  let raised = 0;
  for (const source of sources) {
    const remaining = wanted - raised;
    if (remaining <= 0.01) break;
    const balance = balances[source.id] ?? 0;
    const available = Math.min(balance, balance - (growthThisYear[source.id] ?? 0) - (creditedThisYear[source.id] ?? 0));
    if (available <= 0.01) continue;
    const taken = Math.min(available, remaining);
    balances[source.id] = balance - taken;
    record(source.id, taken);
    raised += taken;
  }
  return raised;
}

/** Adds `b` into `a` key-wise, so a person's own contribution to a shared bucket isn't overwritten by the bucket's household-level one. */
function mergeSums(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = { ...a };
  for (const [key, value] of Object.entries(b)) out[key] = (out[key] ?? 0) + value;
  return out;
}
