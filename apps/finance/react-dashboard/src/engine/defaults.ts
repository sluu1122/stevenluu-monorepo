import { generateId } from './id';
import { getDefaultFederalTable } from './taxBrackets';
import { US_SOCIAL_SECURITY_2026, CA_CPP_2026, CA_OAS_2026 } from './benefitDefaults';
import { ACCOUNT_KIND_META, US_ACCOUNT_KINDS, CA_ACCOUNT_KINDS, DEFAULT_HOUSEHOLD_WITHDRAWAL_ORDER } from './accountKindMeta';
import { CURRENT_SCHEMA_VERSION, DEFAULT_REQUIRED_DISTRIBUTION_RULE, DEFAULT_RETURN_RATES, DEFAULT_SHARED_CASH_BUFFER_RULE, DEFAULT_TAXABLE_ACCOUNT_TAXATION } from './schema';
import { PROVINCIAL_TAX_TABLES } from './provincialTaxTables';
import type { AccountBucket, AccountKind, BenefitConfig, PersonPlan, Scenario } from './schema';

// Growth rates are scenario-level now (see DEFAULT_RETURN_RATES), so a seeded
// account only carries what's genuinely its own: a balance and a contribution.
const SEED_AMOUNTS_BY_KIND: Record<AccountKind, { startingBalance: number; annualContributionWhileWorking?: number }> = {
  US_CASH_HYSA: { startingBalance: 30_000 },
  US_TAXABLE_BROKERAGE: { startingBalance: 200_000, annualContributionWhileWorking: 10_000 },
  US_TRADITIONAL_401K_IRA: { startingBalance: 400_000, annualContributionWhileWorking: 24_500 },
  US_ROTH_401K_IRA: { startingBalance: 100_000, annualContributionWhileWorking: 7_500 },
  CA_CASH_POOL: { startingBalance: 30_000 },
  CA_NON_REGISTERED: { startingBalance: 200_000, annualContributionWhileWorking: 10_000 },
  CA_RRSP_RRIF: { startingBalance: 400_000, annualContributionWhileWorking: 32_490 },
  CA_TFSA: { startingBalance: 100_000, annualContributionWhileWorking: 7_000 },
};

function createSeededAccountBucket(kind: AccountKind): AccountBucket {
  const meta = ACCOUNT_KIND_META[kind];
  const seed = SEED_AMOUNTS_BY_KIND[kind];
  return {
    id: generateId('bucket'),
    label: meta.label,
    country: meta.country,
    kind,
    taxTreatment: meta.taxTreatment,
    isCashBuffer: meta.isCashBuffer,
    ...seed,
  };
}

function createUSAccountBuckets(): AccountBucket[] {
  return US_ACCOUNT_KINDS.map(createSeededAccountBucket);
}

function createCAAccountBuckets(): AccountBucket[] {
  return CA_ACCOUNT_KINDS.map(createSeededAccountBucket);
}

function createDefaultBenefits(country: 'US' | 'CA'): BenefitConfig[] {
  if (country === 'US') {
    return [
      {
        type: 'US_SOCIAL_SECURITY',
        claimAge: US_SOCIAL_SECURITY_2026.fullRetirementAge,
        monthlyBenefitAtClaimAge: 2_200,
        colaPct: US_SOCIAL_SECURITY_2026.colaPct,
      },
    ];
  }
  return [
    {
      type: 'CA_CPP',
      claimAge: 65,
      monthlyBenefitAtClaimAge: Math.round(CA_CPP_2026.maxMonthlyBenefitAt65 * 0.6),
      colaPct: 2.8,
    },
    {
      type: 'CA_OAS',
      claimAge: 65,
      monthlyBenefitAtClaimAge: CA_OAS_2026.maxMonthlyBenefit65To74,
      colaPct: 2.8,
    },
  ];
}

/**
 * A complete, self-contained plan for one person - seeded with their own
 * account set, waterfall, cash-buffer rule and benefits. "Add Person" reuses
 * this so a new person arrives ready to edit rather than as an empty shell.
 */
export function createDefaultPersonPlan(country: 'US' | 'CA', label: string): PersonPlan {
  const accountBuckets = country === 'US' ? createUSAccountBuckets() : createCAAccountBuckets();
  const nonCashBuckets = accountBuckets.filter((b) => !b.isCashBuffer);

  // The order spending draws these down is the household's now (see
  // Scenario.householdWithdrawalOrder); this ordering is only used to seed the
  // cash-buffer replenishment list, which is still per-person.
  const treatmentOrder: Record<string, number> = { taxable: 0, taxDeferred: 1, taxFree: 2 };
  const orderedNonCash = [...nonCashBuckets].sort((a, b) => treatmentOrder[a.taxTreatment] - treatmentOrder[b.taxTreatment]);

  return {
    id: generateId('person'),
    label,
    birthYear: new Date().getFullYear() - 35,
    planningEndAge: 95,
    retirementStartYear: null,
    annualIncomeNominal: 0,
    incomeGrowthRatePct: 0,
    accountBuckets,
    cashBufferRule: {
      enabled: true,
      targetMonthsOfSpending: 6,
      replenishmentOrder: orderedNonCash.map((b) => b.id),
    },
    meltdownRules: [],
    requiredDistributionRule: { ...DEFAULT_REQUIRED_DISTRIBUTION_RULE },
    incomeSources: [],
    benefits: createDefaultBenefits(country),
    surplusDestinationAccountBucketId: null,
  };
}

export function createDefaultScenario(country: 'US' | 'CA', name = 'New Scenario'): Scenario {
  const now = new Date().toISOString();

  return {
    id: generateId('scenario'),
    name,
    country,
    version: CURRENT_SCHEMA_VERSION,
    currency: country === 'US' ? 'USD' : 'CAD',
    exchangeRateUsdToCad: 1.35,
    returnRates: { ...DEFAULT_RETURN_RATES },
    indexTaxThresholdsToInflation: true,
    householdSpendingRealBeforeRetirement: 0,
    householdSpendingRealAtRetirement: 60_000,
    // Empty means "use the statutory age for every kind"; the Household tab
    // writes entries here only for the kinds the user actually overrides.
    accountAvailabilityAges: {},
    householdWithdrawalOrder: [...DEFAULT_HOUSEHOLD_WITHDRAWAL_ORDER],
    persons: [createDefaultPersonPlan(country, 'Person 1')],
    // Joint accounts are opt-in - a new scenario starts with none, and the
    // household cash buffer stays off until one exists to hold it.
    sharedAccountBuckets: [],
    sharedCashBufferRule: { ...DEFAULT_SHARED_CASH_BUFFER_RULE },
    taxConfig: {
      country,
      filingStatus: 'single',
      federalTable: getDefaultFederalTable(country, 'single'),
      // Seeded with a real table rather than a rate, since a flat percentage
      // was never right for anyone. BC for a Canadian scenario because it's
      // the most common case here; a US one starts with no state tax, which
      // IS correct for several states and obvious when it isn't.
      stateOrProvincialTable: country === 'CA' ? { ...PROVINCIAL_TAX_TABLES.BC } : { ...PROVINCIAL_TAX_TABLES.US_NO_STATE_TAX },
    },
    taxableAccountTaxation: { ...DEFAULT_TAXABLE_ACCOUNT_TAXATION },
    inflation: {
      mode: 'flat',
      flatRatePct: 2.5,
    },
    createdAt: now,
    updatedAt: now,
  };
}
