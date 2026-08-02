import { generateId } from './id';
import { getDefaultFederalTable } from './taxBrackets';
import { US_SOCIAL_SECURITY_2026, CA_CPP_2026, CA_OAS_2026 } from './benefitDefaults';
import { ACCOUNT_KIND_META, US_ACCOUNT_KINDS, CA_ACCOUNT_KINDS } from './accountKindMeta';
import { CURRENT_SCHEMA_VERSION } from './schema';
import type { AccountBucket, AccountKind, BenefitConfig, Scenario } from './schema';

const SEED_AMOUNTS_BY_KIND: Record<AccountKind, { startingBalance: number; preRetirementReturnPct: number; postRetirementReturnPct: number; annualContributionWhileWorking?: number }> = {
  US_CASH_HYSA: { startingBalance: 30_000, preRetirementReturnPct: 2, postRetirementReturnPct: 2 },
  US_TAXABLE_BROKERAGE: { startingBalance: 200_000, preRetirementReturnPct: 7, postRetirementReturnPct: 5, annualContributionWhileWorking: 10_000 },
  US_TRADITIONAL_401K_IRA: { startingBalance: 400_000, preRetirementReturnPct: 7, postRetirementReturnPct: 5, annualContributionWhileWorking: 24_500 },
  US_ROTH_401K_IRA: { startingBalance: 100_000, preRetirementReturnPct: 7, postRetirementReturnPct: 5, annualContributionWhileWorking: 7_500 },
  CA_CASH_POOL: { startingBalance: 30_000, preRetirementReturnPct: 2, postRetirementReturnPct: 2 },
  CA_NON_REGISTERED: { startingBalance: 200_000, preRetirementReturnPct: 7, postRetirementReturnPct: 5, annualContributionWhileWorking: 10_000 },
  CA_RRSP_RRIF: { startingBalance: 400_000, preRetirementReturnPct: 7, postRetirementReturnPct: 5, annualContributionWhileWorking: 32_490 },
  CA_TFSA: { startingBalance: 100_000, preRetirementReturnPct: 7, postRetirementReturnPct: 5, annualContributionWhileWorking: 7_000 },
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

export function createDefaultScenario(country: 'US' | 'CA', name = 'New Scenario'): Scenario {
  const now = new Date().toISOString();
  const accountBuckets = country === 'US' ? createUSAccountBuckets() : createCAAccountBuckets();
  const cashBucket = accountBuckets.find((b) => b.isCashBuffer)!;
  const nonCashBuckets = accountBuckets.filter((b) => !b.isCashBuffer);

  // Waterfall: cash buffer first, then taxable, then tax-deferred, then tax-free.
  const treatmentOrder: Record<string, number> = { taxable: 0, taxDeferred: 1, taxFree: 2 };
  const orderedNonCash = [...nonCashBuckets].sort(
    (a, b) => treatmentOrder[a.taxTreatment] - treatmentOrder[b.taxTreatment],
  );
  const waterfall = [cashBucket, ...orderedNonCash].map((bucket, index) => ({
    order: index,
    accountBucketId: bucket.id,
  }));

  return {
    id: generateId('scenario'),
    name,
    country,
    version: CURRENT_SCHEMA_VERSION,
    currency: country === 'US' ? 'USD' : 'CAD',
    exchangeRateUsdToCad: 1.35,
    birthYear: new Date().getFullYear() - 35,
    planningEndAge: 95,
    retirementStartYear: null,
    accountBuckets,
    waterfall,
    cashBufferRule: {
      enabled: true,
      targetMonthsOfSpending: 6,
      replenishmentOrder: orderedNonCash.map((b) => b.id),
    },
    taxConfig: {
      country,
      filingStatus: 'single',
      federalTable: getDefaultFederalTable(country, 'single'),
      stateOrProvincialFlatRatePct: 5,
    },
    inflation: {
      mode: 'flat',
      flatRatePct: 2.5,
    },
    incomeSources: [],
    benefits: createDefaultBenefits(country),
    annualSpendingRealAtRetirement: 60_000,
    createdAt: now,
    updatedAt: now,
  };
}
