import { z } from 'zod';

export const CountrySchema = z.enum(['US', 'CA']);
export const FilingStatusSchema = z.enum(['single', 'marriedFilingJointly']);
export const CurrencySchema = z.enum(['USD', 'CAD']);
export type Country = z.infer<typeof CountrySchema>;
export type FilingStatus = z.infer<typeof FilingStatusSchema>;
export type Currency = z.infer<typeof CurrencySchema>;

export const TaxBracketSchema = z.object({
  min: z.number().nonnegative(),
  max: z.number().positive().nullable(),
  rate: z.number().min(0).max(1),
});
export type TaxBracket = z.infer<typeof TaxBracketSchema>;

export const FederalTaxTableSchema = z.object({
  country: CountrySchema,
  year: z.number().int(),
  filingStatus: FilingStatusSchema,
  brackets: z.array(TaxBracketSchema).min(1),
  standardDeductionOrBPA: z.number().nonnegative(),
});
export type FederalTaxTable = z.infer<typeof FederalTaxTableSchema>;

/**
 * A province's or state's own progressive table, replacing what used to be a
 * single flat rate applied to gross income. That flat rate understated the
 * cost of a large withdrawal badly - every province is progressive, and the
 * top rate is several times the bottom one - which in turn made an aggressive
 * meltdown look cheaper than it is.
 *
 * The basic personal amount here is a CREDIT at `creditRate`, not a deduction,
 * because that is how both the CRA and the provinces actually grant it: it is
 * worth the same to every taxpayer regardless of marginal rate.
 *
 * `surtax` is Ontario's, and only Ontario's: a tax on the tax itself, charged
 * once provincial tax passes a threshold. Left empty everywhere else.
 */
export const SurtaxBandSchema = z.object({
  /** Provincial tax above this amount is surtaxed. */
  taxOver: z.number().nonnegative(),
  rate: z.number().min(0).max(1),
});
export type SurtaxBand = z.infer<typeof SurtaxBandSchema>;

export const StateOrProvincialTaxTableSchema = z.object({
  /** Display name, e.g. "British Columbia" - also what the UI preset picker matches on. */
  label: z.string().min(1),
  brackets: z.array(TaxBracketSchema).min(1),
  basicPersonalAmount: z.number().nonnegative(),
  /** Rate the basic personal amount is credited at; conventionally the lowest bracket's rate. */
  creditRate: z.number().min(0).max(1),
  surtax: z.array(SurtaxBandSchema),
  /**
   * Whether this region taxes Social Security benefits at all. Meaningless
   * for a Canadian province (CPP/OAS aren't Social Security and are already
   * fully taxable, see ledger.ts) and false for the great majority of US
   * states, which fully exempt it.
   *
   * Kept required rather than `.default()`, which would split the schema's
   * input and output types and break react-hook-form's resolver (see
   * `indexTaxThresholdsToInflation` above). Backfilled to `false` by the
   * v9 -> v10 migration for a scenario saved before this field existed.
   */
  taxesSocialSecurity: z.boolean(),
});
export type StateOrProvincialTaxTable = z.infer<typeof StateOrProvincialTaxTableSchema>;

export const TaxConfigSchema = z.object({
  country: CountrySchema,
  filingStatus: FilingStatusSchema,
  federalTable: FederalTaxTableSchema,
  stateOrProvincialTable: StateOrProvincialTaxTableSchema,
});
export type TaxConfig = z.infer<typeof TaxConfigSchema>;

/**
 * How a non-registered account's return is taxed as it is earned and as it is
 * sold. Without this the engine taxed only withdrawals from tax-DEFERRED
 * accounts, so a taxable brokerage compounded entirely tax-free - the single
 * largest source of optimism in a long projection.
 *
 * Two components, because they are taxed differently and at different times:
 *   - `annualDistributionYieldPct` of the account's value is paid out each year
 *     as interest and dividends, taxable AS EARNED at full rates and reinvested
 *     (which is why it raises the cost basis - it has already been taxed once).
 *   - Everything else is unrealized appreciation, taxable only when sold, and
 *     then only `capitalGainsInclusionRatePct` of the gain.
 *
 * The dividend gross-up and dividend tax credit are NOT modelled: distributions
 * are treated as ordinary income, which is right for interest and for foreign
 * dividends but overstates the tax on eligible Canadian dividends.
 */
export const TaxableAccountTaxationSchema = z.object({
  enabled: z.boolean(),
  annualDistributionYieldPct: z.number().min(0).max(100),
  capitalGainsInclusionRatePct: z.number().min(0).max(100),
});
export type TaxableAccountTaxation = z.infer<typeof TaxableAccountTaxationSchema>;

export const DEFAULT_TAXABLE_ACCOUNT_TAXATION: TaxableAccountTaxation = {
  enabled: true,
  // A broad equity/bond portfolio distributes roughly 2% a year; the rest of
  // the return is appreciation that goes untaxed until it is sold.
  annualDistributionYieldPct: 2,
  // Canada's inclusion rate. The 2024 proposal to raise it above $250k of gains
  // was withdrawn, so this is a flat 50%.
  capitalGainsInclusionRatePct: 50,
};

export const USAccountKindSchema = z.enum([
  'US_TAXABLE_BROKERAGE',
  'US_TRADITIONAL_401K_IRA',
  'US_ROTH_401K_IRA',
  'US_CASH_HYSA',
]);
export const CAAccountKindSchema = z.enum([
  'CA_NON_REGISTERED',
  'CA_RRSP_RRIF',
  'CA_TFSA',
  'CA_CASH_POOL',
]);
export const AccountKindSchema = z.union([USAccountKindSchema, CAAccountKindSchema]);
export type AccountKind = z.infer<typeof AccountKindSchema>;

export const TaxTreatmentSchema = z.enum(['taxable', 'taxDeferred', 'taxFree']);
export type TaxTreatment = z.infer<typeof TaxTreatmentSchema>;

export const AccountBucketSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  country: CountrySchema,
  kind: AccountKindSchema,
  taxTreatment: TaxTreatmentSchema,
  startingBalance: z.number().nonnegative(),
  /**
   * What was originally paid for what this account holds - the adjusted cost
   * base. Only meaningful on a `taxable` account, where the difference between
   * this and the balance is an embedded gain that will be taxed when sold.
   *
   * Omitted means "assume no embedded gain", i.e. a cost basis equal to the
   * starting balance, which is the neutral assumption rather than a true one.
   * Someone holding a long-held position with a low cost base pays materially
   * more tax on the way out, so this is worth filling in.
   */
  costBasis: z.number().nonnegative().optional(),
  annualContributionWhileWorking: z.number().nonnegative().optional(),
  /**
   * Whether `annualContributionWhileWorking` keeps running once this account's
   * owner has retired. Off by default, which is the plain reading of the field
   * name and what every scenario did before this existed.
   *
   * It's per-account because the answer genuinely differs by account: a TFSA
   * accrues room every year regardless of employment or income, so a retiree
   * can and often does keep topping it up out of cash, while an RRSP or a
   * 401(k) needs earned income and has nothing to contribute from. On a shared
   * account it's the household's answer - contributions there stop once
   * EVERYONE has retired, unless this is set.
   */
  contributeInRetirement: z.boolean().optional(),
  /**
   * Whether `annualContributionWhileWorking` rises with inflation, the way a
   * legislated contribution limit does. Off by default, so a figure the user
   * typed stays the figure they typed.
   *
   * The amount is indexed in the account's OWN currency and then rounded to
   * that kind's statutory step (ACCOUNT_KIND_META.contributionIndexRoundingStep
   * - $500 for a TFSA or a 401(k)/IRA), because the real limits move in steps
   * rather than by a smooth percentage.
   */
  indexContributionToInflation: z.boolean().optional(),
  isCashBuffer: z.boolean().optional(),
});
export type AccountBucket = z.infer<typeof AccountBucketSchema>;

export const WaterfallStepSchema = z.object({
  order: z.number().int().nonnegative(),
  accountBucketId: z.string(),
});
export const WaterfallRuleSchema = z.array(WaterfallStepSchema);
export type WaterfallStep = z.infer<typeof WaterfallStepSchema>;
export type WaterfallRule = z.infer<typeof WaterfallRuleSchema>;

export const CashBufferRuleSchema = z.object({
  enabled: z.boolean(),
  targetMonthsOfSpending: z.number().nonnegative(),
  replenishmentOrder: z.array(z.string()),
});
export type CashBufferRule = z.infer<typeof CashBufferRuleSchema>;

/**
 * A household-level cash buffer held in a shared account. When enabled it
 * REPLACES the per-person rules: the target is measured against total
 * household spending, and the shortfall is sourced from each person's
 * accounts in proportion to their share of that spending. Without it, each
 * person maintains their own buffer exactly as before.
 */
export const SharedCashBufferRuleSchema = z.object({
  enabled: z.boolean(),
  /** Must name one of `sharedAccountBuckets`. */
  targetAccountBucketId: z.string().nullable(),
  targetMonthsOfSpending: z.number().nonnegative(),
});
export type SharedCashBufferRule = z.infer<typeof SharedCashBufferRuleSchema>;

export const DEFAULT_SHARED_CASH_BUFFER_RULE: SharedCashBufferRule = {
  enabled: false,
  targetAccountBucketId: null,
  targetMonthsOfSpending: 6,
};

export const InflationYearOverrideSchema = z.object({
  year: z.number().int(),
  ratePct: z.number(),
});
export const InflationAssumptionSchema = z.object({
  mode: z.enum(['flat', 'byYear']),
  flatRatePct: z.number().optional(),
  byYear: z.array(InflationYearOverrideSchema).optional(),
});
export type InflationAssumption = z.infer<typeof InflationAssumptionSchema>;

export const IncomeSourceSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  startYear: z.number().int(),
  endYear: z.number().int().optional(),
  annualAmountNominal: z.number().nonnegative(),
  growthRatePct: z.number(),
});
export type IncomeSource = z.infer<typeof IncomeSourceSchema>;

export const BenefitTypeSchema = z.enum(['US_SOCIAL_SECURITY', 'CA_CPP', 'CA_OAS']);
export type BenefitType = z.infer<typeof BenefitTypeSchema>;
// A benefit belongs to whichever person's plan it sits inside - no owner tag
// is needed now that benefits live on the person rather than the scenario.
export const BenefitConfigSchema = z.object({
  type: BenefitTypeSchema,
  claimAge: z.number().int().positive(),
  monthlyBenefitAtClaimAge: z.number().nonnegative(),
  colaPct: z.number(),
});
export type BenefitConfig = z.infer<typeof BenefitConfigSchema>;

// "Melting down" a tax-deferred account: deliberately withdrawing beyond the
// spending need, up to a target taxable-income ceiling, during a window
// (e.g. the gap between retirement and RRIF/RMD age) to smooth taxable
// income across lower-tax years instead of one huge forced withdrawal later.
// After-tax surplus is reinvested into a chosen destination bucket. One rule
// per tax-deferred account, so each account can melt down on its own schedule.
export const MeltdownRuleSchema = z.object({
  accountBucketId: z.string(),
  enabled: z.boolean(),
  targetTaxableIncomeCeiling: z.number().nonnegative(),
  startYear: z.number().int().nullable(),
  endYear: z.number().int().nullable(),
  destinationAccountBucketId: z.string().nullable(),
});
export type MeltdownRule = z.infer<typeof MeltdownRuleSchema>;

/**
 * Statutory minimum withdrawals from tax-deferred accounts - US RMDs and
 * Canadian RRIF minimums. Unlike a meltdown these aren't a strategy, they're
 * compulsory, so this is on by default and applies to every tax-deferred
 * account automatically; the age and percentage come from the government
 * tables in requiredDistributions.ts rather than being configured here.
 *
 * The proceeds top up the cash buffer first - the money has to come out
 * regardless, so covering a cash need with it beats selling something else -
 * and whatever's left over is reinvested.
 */
export const RequiredDistributionRuleSchema = z.object({
  enabled: z.boolean(),
  /** Overrides the statutory start age. Null uses the age the law sets for this person's birth year and account country. */
  startAgeOverride: z.number().int().positive().nullable(),
  /** Where the portion the cash buffer doesn't need is reinvested. Null falls back to this person's surplus destination. */
  destinationAccountBucketId: z.string().nullable(),
});
export type RequiredDistributionRule = z.infer<typeof RequiredDistributionRuleSchema>;

export const DEFAULT_REQUIRED_DISTRIBUTION_RULE: RequiredDistributionRule = {
  enabled: true,
  startAgeOverride: null,
  destinationAccountBucketId: null,
};

export function createDefaultMeltdownRule(accountBucketId: string): MeltdownRule {
  return {
    accountBucketId,
    enabled: false,
    targetTaxableIncomeCeiling: 0,
    startYear: null,
    endYear: null,
    destinationAccountBucketId: null,
  };
}

/**
 * The only account kinds that can be held jointly. Registered accounts
 * (RRSP/RRIF, TFSA, 401(k)/IRA, Roth) are individual by law in both
 * countries, so they stay per-person. This is not only realism: every kind
 * here is `taxable`, and the engine taxes only tax-deferred withdrawals, so
 * a shared account can never produce taxable income - which is what keeps
 * per-person tax isolation intact once two people draw from the same pot.
 */
export const SHARED_ACCOUNT_KINDS: AccountKind[] = ['CA_NON_REGISTERED', 'CA_CASH_POOL', 'US_TAXABLE_BROKERAGE', 'US_CASH_HYSA'];

/**
 * A person and their financial plan. Accounts listed here belong to this
 * person alone; jointly-held money lives in `Scenario.sharedAccountBuckets`.
 * Their cash-buffer rule and meltdown rules may reference their own bucket
 * ids or (for the replenishment order) shared ones - but their tax is always
 * assessed on their own income alone, which is how tax actually works in both
 * the US and Canada. The order spending draws accounts down is no longer
 * per-person at all: see Scenario.householdWithdrawalOrder.
 */
export const PersonPlanSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  birthYear: z.number().int(),
  planningEndAge: z.number().int().positive(),
  retirementStartYear: z.number().int().nullable(),
  annualIncomeNominal: z.number().nonnegative(),
  incomeGrowthRatePct: z.number(),
  accountBuckets: z.array(AccountBucketSchema),
  cashBufferRule: CashBufferRuleSchema,
  meltdownRules: z.array(MeltdownRuleSchema),
  /** Optional so scenarios saved before this existed still load; absent means DEFAULT_REQUIRED_DISTRIBUTION_RULE. */
  requiredDistributionRule: RequiredDistributionRuleSchema.optional(),
  incomeSources: z.array(IncomeSourceSchema),
  benefits: z.array(BenefitConfigSchema),
  /**
   * Where leftover income (after this person's own spending and tax) is
   * banked. May name one of their own accounts or a shared one - pointing it
   * at a shared account is how one person's earnings fund the household.
   * Null falls back to their own cash-buffer account, the prior behavior.
   */
  surplusDestinationAccountBucketId: z.string().nullable(),
});
export type PersonPlan = z.infer<typeof PersonPlanSchema>;

export const GridOverrideSchema = z.object({
  id: z.string(),
  scenarioId: z.string(),
  personId: z.string(),
  year: z.number().int(),
  field: z.string().min(1),
  value: z.number(),
  note: z.string().optional(),
  createdAt: z.string(),
});
export type GridOverride = z.infer<typeof GridOverrideSchema>;

/**
 * Growth assumptions for the whole scenario, split only by what an account is
 * FOR rather than by account: every invested dollar compounds at one rate and
 * every cash dollar at another. These used to be per-account, which meant a
 * six-account household had twelve numbers to keep consistent and a single
 * forgotten one quietly skewed the projection.
 *
 * Investments still split pre/post retirement, since a glide path toward a
 * more conservative allocation at retirement is a real and common choice.
 * Cash does NOT: a savings rate doesn't move because its owner retired, it
 * moves with prevailing short rates, which this model doesn't otherwise
 * simulate - the pre/post split was two numbers a user had to keep in sync
 * for no behavior anyone actually wanted. `isCashBuffer` still decides which
 * of the two rates an account uses.
 */
export const ReturnRatesSchema = z.object({
  investmentsPreRetirementPct: z.number(),
  investmentsPostRetirementPct: z.number(),
  cashPct: z.number(),
});
export type ReturnRates = z.infer<typeof ReturnRatesSchema>;

/** The growth rate this account earns in a given year, in percent. */
export function returnRatePctFor(bucket: Pick<AccountBucket, 'isCashBuffer'>, rates: ReturnRates, isRetired: boolean): number {
  if (bucket.isCashBuffer) return rates.cashPct;
  return isRetired ? rates.investmentsPostRetirementPct : rates.investmentsPreRetirementPct;
}

export const ScenarioSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  country: CountrySchema,
  version: z.number().int().nonnegative(),
  currency: CurrencySchema,
  exchangeRateUsdToCad: z.number().positive(),
  returnRates: ReturnRatesSchema,
  /**
   * Whether tax brackets, the standard deduction/BPA, and the OAS clawback
   * threshold rise with inflation each year. Both the CRA and the IRS index
   * these annually by statute, so ON is the accurate setting and the default.
   *
   * It's a toggle rather than a hardcoded behavior because a bracket freeze is
   * a real policy risk worth stress-testing - the US didn't index brackets at
   * all before 1985, and freezing them is a recurring proposal on both sides
   * of the border. Left off across a long projection, inflation alone drags
   * every withdrawal into the top bracket and claws back all of OAS.
   *
   * Backfilled to true by the v6 -> v7 migration, so a scenario saved before
   * this existed picks up the accurate behavior. Kept required rather than
   * `.default()`, which would split the schema's input and output types and
   * break react-hook-form's resolver.
   */
  indexTaxThresholdsToInflation: z.boolean(),
  /**
   * What the household spends per year in today's dollars, split across
   * persons by `householdWithdrawalOrder`. Budgeted at household level because that's
   * how people actually think about it - one grocery bill, one mortgage.
   *
   * The switch from the before figure to the at-retirement one happens when
   * the EARLIEST-retiring person retires, the same household-level rule shared
   * accounts already use to flip their growth rate. Keying it off each
   * person's own retirement instead would make a staggered household spend
   * less than either figure during the gap years.
   */
  householdSpendingRealBeforeRetirement: z.number().nonnegative(),
  householdSpendingRealAtRetirement: z.number().nonnegative(),
  /**
   * Per-KIND overrides for the age an account becomes reachable. An entry that
   * is absent falls back to the statutory age in ACCOUNT_KIND_META; an entry
   * set to null means no restriction at all.
   *
   * Scoped to the kind rather than the account because the rule being modelled
   * is the government's, and a household with three 401(k)s should not be able
   * to give them three different answers.
   */
  accountAvailabilityAges: z.partialRecord(AccountKindSchema, z.number().nullable()),
  /**
   * The order spending draws down account KINDS, for the whole household.
   *
   * Ordering by kind rather than by account is what makes "spend taxable
   * before tax-free" sayable once instead of re-stated in every person's list
   * and re-checked every time an account is added. A kind that isn't in this
   * array is never drawn to fund spending at all - which is how a TFSA gets
   * left alone - though replenishment, meltdowns and statutory minimums each
   * keep their own rules and can still reach it.
   *
   * Within one kind, joint accounts are drawn before personal ones: a
   * household spends the money it holds together first.
   */
  householdWithdrawalOrder: z.array(AccountKindSchema),
  persons: z.array(PersonPlanSchema).min(1),
  /**
   * Jointly-held accounts any person can contribute to and draw from. The
   * `taxable` refinement enforces SHARED_ACCOUNT_KINDS' guarantee at the
   * schema level: no shared bucket can ever be tax-deferred, so drawing from
   * one never lands in another person's taxable income.
   */
  sharedAccountBuckets: z.array(AccountBucketSchema.refine((b) => b.taxTreatment === 'taxable', { message: 'Shared accounts must be taxable (registered accounts are individual-only).' })),
  sharedCashBufferRule: SharedCashBufferRuleSchema,
  taxConfig: TaxConfigSchema,
  /** How non-registered accounts are taxed as they earn and as they are sold. */
  taxableAccountTaxation: TaxableAccountTaxationSchema,
  inflation: InflationAssumptionSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Scenario = z.infer<typeof ScenarioSchema>;

export const ExportBundleSchema = z.object({
  schemaVersion: z.number().int().nonnegative(),
  exportedAt: z.string(),
  scenarios: z.array(ScenarioSchema),
  overrides: z.array(GridOverrideSchema),
});
export type ExportBundle = z.infer<typeof ExportBundleSchema>;

export const CURRENT_SCHEMA_VERSION = 10;

/** Applied to any scenario predating scenario-level rates that had no per-account rate to derive one from. */
export const DEFAULT_RETURN_RATES: ReturnRates = {
  investmentsPreRetirementPct: 7,
  investmentsPostRetirementPct: 5,
  cashPct: 2,
};
