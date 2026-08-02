import { generateId } from './id';
import { getDefaultFederalTable } from './taxBrackets';
import { US_SOCIAL_SECURITY_2026, CA_CPP_2026, CA_OAS_2026 } from './benefitDefaults';
import { CURRENT_SCHEMA_VERSION } from './schema';
import type { AccountBucket, BenefitConfig, Scenario } from './schema';

function createUSAccountBuckets(): AccountBucket[] {
  return [
    {
      id: generateId('bucket'),
      label: 'Cash / HYSA',
      country: 'US',
      kind: 'US_CASH_HYSA',
      taxTreatment: 'taxable',
      startingBalance: 30_000,
      preRetirementReturnPct: 2,
      postRetirementReturnPct: 2,
      isCashBuffer: true,
    },
    {
      id: generateId('bucket'),
      label: 'Taxable Brokerage',
      country: 'US',
      kind: 'US_TAXABLE_BROKERAGE',
      taxTreatment: 'taxable',
      startingBalance: 200_000,
      preRetirementReturnPct: 7,
      postRetirementReturnPct: 5,
      annualContributionWhileWorking: 10_000,
    },
    {
      id: generateId('bucket'),
      label: 'Traditional 401(k)/IRA',
      country: 'US',
      kind: 'US_TRADITIONAL_401K_IRA',
      taxTreatment: 'taxDeferred',
      startingBalance: 400_000,
      preRetirementReturnPct: 7,
      postRetirementReturnPct: 5,
      annualContributionWhileWorking: 24_500,
    },
    {
      id: generateId('bucket'),
      label: 'Roth 401(k)/IRA',
      country: 'US',
      kind: 'US_ROTH_401K_IRA',
      taxTreatment: 'taxFree',
      startingBalance: 100_000,
      preRetirementReturnPct: 7,
      postRetirementReturnPct: 5,
      annualContributionWhileWorking: 7_500,
    },
  ];
}

function createCAAccountBuckets(): AccountBucket[] {
  return [
    {
      id: generateId('bucket'),
      label: 'Cash Pool',
      country: 'CA',
      kind: 'CA_CASH_POOL',
      taxTreatment: 'taxable',
      startingBalance: 30_000,
      preRetirementReturnPct: 2,
      postRetirementReturnPct: 2,
      isCashBuffer: true,
    },
    {
      id: generateId('bucket'),
      label: 'Non-Registered',
      country: 'CA',
      kind: 'CA_NON_REGISTERED',
      taxTreatment: 'taxable',
      startingBalance: 200_000,
      preRetirementReturnPct: 7,
      postRetirementReturnPct: 5,
      annualContributionWhileWorking: 10_000,
    },
    {
      id: generateId('bucket'),
      label: 'RRSP/RRIF',
      country: 'CA',
      kind: 'CA_RRSP_RRIF',
      taxTreatment: 'taxDeferred',
      startingBalance: 400_000,
      preRetirementReturnPct: 7,
      postRetirementReturnPct: 5,
      annualContributionWhileWorking: 32_490,
    },
    {
      id: generateId('bucket'),
      label: 'TFSA',
      country: 'CA',
      kind: 'CA_TFSA',
      taxTreatment: 'taxFree',
      startingBalance: 100_000,
      preRetirementReturnPct: 7,
      postRetirementReturnPct: 5,
      annualContributionWhileWorking: 7_000,
    },
  ];
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
