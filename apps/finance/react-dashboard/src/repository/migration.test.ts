import { describe, expect, it } from 'vitest';
import { migrateStorageBlob } from './localStorageScenarioRepository';
import { DEFAULT_RETURN_RATES, ExportBundleSchema } from '../engine/schema';
import { availableFromAgeFor } from '../engine/accountKindMeta';

/**
 * A blob in the shape the app actually saved before this refactor: one
 * shared pool of accounts/waterfall/cash buffer/meltdown/income/spending,
 * two persons, owner-tagged benefits, and a grid override with no personId.
 */
function v3Blob() {
  return {
    schemaVersion: 3,
    exportedAt: '2026-08-01T00:00:00.000Z',
    scenarios: [
      {
        id: 'scenario-1',
        name: 'Retirement',
        country: 'CA',
        version: 3,
        currency: 'CAD',
        exchangeRateUsdToCad: 1.35,
        household: {
          persons: [
            {
              id: 'person-1',
              label: 'Person 1',
              birthYear: 1985,
              planningEndAge: 95,
              retirementStartYear: 2030,
              annualIncomeNominal: 0,
              incomeGrowthRatePct: 0,
            },
            {
              id: 'person-2',
              label: 'Person 2',
              birthYear: 1987,
              planningEndAge: 97,
              retirementStartYear: 2035,
              annualIncomeNominal: 90_000,
              incomeGrowthRatePct: 2,
            },
          ],
        },
        accountBuckets: [
          {
            id: 'bucket-cash',
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
            id: 'bucket-rrsp',
            label: 'RRSP',
            country: 'CA',
            kind: 'CA_RRSP_RRIF',
            taxTreatment: 'taxDeferred',
            startingBalance: 400_000,
            preRetirementReturnPct: 7,
            postRetirementReturnPct: 5,
          },
          {
            id: 'bucket-rrsp-2',
            label: 'Spousal RRSP',
            country: 'CA',
            kind: 'CA_RRSP_RRIF',
            taxTreatment: 'taxDeferred',
            startingBalance: 150_000,
            preRetirementReturnPct: 7,
            postRetirementReturnPct: 5,
          },
          {
            id: 'bucket-tfsa',
            label: 'TFSA',
            country: 'CA',
            kind: 'CA_TFSA',
            taxTreatment: 'taxFree',
            startingBalance: 100_000,
            preRetirementReturnPct: 7,
            postRetirementReturnPct: 5,
          },
        ],
        waterfall: [
          { order: 0, accountBucketId: 'bucket-cash' },
          { order: 1, accountBucketId: 'bucket-rrsp' },
          { order: 2, accountBucketId: 'bucket-rrsp-2' },
          { order: 3, accountBucketId: 'bucket-tfsa' },
        ],
        cashBufferRule: { enabled: true, targetMonthsOfSpending: 6, replenishmentOrder: ['bucket-rrsp', 'bucket-tfsa'] },
        meltdownRule: {
          enabled: true,
          sourceAccountBucketIds: ['bucket-rrsp', 'bucket-rrsp-2'],
          targetTaxableIncomeCeiling: 60_000,
          startYear: 2031,
          endYear: 2040,
          destinationAccountBucketId: 'bucket-tfsa',
        },
        taxConfig: {
          country: 'CA',
          filingStatus: 'single',
          federalTable: {
            country: 'CA',
            year: 2026,
            filingStatus: 'single',
            brackets: [
              { min: 0, max: 57_375, rate: 0.15 },
              { min: 57_375, max: null, rate: 0.205 },
            ],
            standardDeductionOrBPA: 16_129,
          },
          stateOrProvincialFlatRatePct: 5,
        },
        inflation: { mode: 'flat', flatRatePct: 2.5 },
        incomeSources: [{ id: 'income-rental', label: 'Rental', startYear: 2026, annualAmountNominal: 12_000, growthRatePct: 1 }],
        benefits: [
          { type: 'CA_CPP', personId: 'person-1', claimAge: 65, monthlyBenefitAtClaimAge: 900, colaPct: 2.8 },
          { type: 'CA_OAS', personId: 'person-1', claimAge: 65, monthlyBenefitAtClaimAge: 727, colaPct: 2.8 },
          { type: 'CA_CPP', personId: 'person-2', claimAge: 67, monthlyBenefitAtClaimAge: 1_100, colaPct: 2.8 },
        ],
        annualSpendingRealBeforeRetirement: 40_000,
        annualSpendingRealAtRetirement: 60_000,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
    ],
    overrides: [
      { id: 'override-1', scenarioId: 'scenario-1', year: 2032, field: 'spendingNominal', value: 75_000, createdAt: '2026-02-01T00:00:00.000Z' },
    ],
  };
}

describe('v3 -> v4 migration', () => {
  it('produces a bundle that passes schema validation (no wipe to empty state)', () => {
    const result = ExportBundleSchema.safeParse(migrateStorageBlob(v3Blob(), 3));
    expect(result.success).toBe(true);
  });

  it('gives Person 1 the whole shared pool and leaves Person 2 with no accounts', () => {
    const bundle = ExportBundleSchema.parse(migrateStorageBlob(v3Blob(), 3));
    const [person1, person2] = bundle.scenarios[0].persons;

    expect(bundle.scenarios[0].persons).toHaveLength(2);
    expect(person1.accountBuckets.map((b) => b.id)).toEqual(['bucket-cash', 'bucket-rrsp', 'bucket-rrsp-2', 'bucket-tfsa']);
    expect(person1.cashBufferRule.enabled).toBe(true);
    expect(person1.incomeSources.map((s) => s.id)).toEqual(['income-rental']);
    // Spending is a household budget now, funded from the household's accounts
    // as a whole rather than apportioned to anyone.
    expect(bundle.scenarios[0].householdSpendingRealBeforeRetirement).toBe(40_000);
    expect(bundle.scenarios[0].householdSpendingRealAtRetirement).toBe(60_000);

    expect(person2.accountBuckets).toHaveLength(0);
    expect(person2.cashBufferRule.enabled).toBe(false);
    expect(person2.incomeSources).toHaveLength(0);
    // Their own identity/timing/income survives intact.
    expect(person2.birthYear).toBe(1987);
    expect(person2.retirementStartYear).toBe(2035);
    expect(person2.annualIncomeNominal).toBe(90_000);
  });

  it('expands the single multi-source meltdown rule into one rule per account', () => {
    const bundle = ExportBundleSchema.parse(migrateStorageBlob(v3Blob(), 3));
    const [person1, person2] = bundle.scenarios[0].persons;

    expect(person1.meltdownRules.map((r) => r.accountBucketId)).toEqual(['bucket-rrsp', 'bucket-rrsp-2']);
    expect(person1.meltdownRules.every((r) => r.enabled && r.targetTaxableIncomeCeiling === 60_000)).toBe(true);
    expect(person1.meltdownRules.every((r) => r.startYear === 2031 && r.endYear === 2040)).toBe(true);
    expect(person1.meltdownRules.every((r) => r.destinationAccountBucketId === 'bucket-tfsa')).toBe(true);
    expect(person2.meltdownRules).toHaveLength(0);
  });

  it('files each benefit under the person its personId named, dropping the tag', () => {
    const bundle = ExportBundleSchema.parse(migrateStorageBlob(v3Blob(), 3));
    const [person1, person2] = bundle.scenarios[0].persons;

    expect(person1.benefits.map((b) => b.type)).toEqual(['CA_CPP', 'CA_OAS']);
    expect(person2.benefits.map((b) => b.type)).toEqual(['CA_CPP']);
    expect(person2.benefits[0].claimAge).toBe(67);
    expect(person1.benefits.every((b) => !('personId' in b))).toBe(true);
  });

  it("stamps every grid override with person 1's id rather than dropping it", () => {
    const bundle = ExportBundleSchema.parse(migrateStorageBlob(v3Blob(), 3));

    expect(bundle.overrides).toHaveLength(1);
    expect(bundle.overrides[0].personId).toBe('person-1');
    expect(bundle.overrides[0].value).toBe(75_000);
  });

  it('removes the old scenario-root fields', () => {
    const migrated = migrateStorageBlob(v3Blob(), 3) as { scenarios: Record<string, unknown>[] };
    const scenario = migrated.scenarios[0];

    for (const field of ['household', 'accountBuckets', 'waterfall', 'cashBufferRule', 'meltdownRule', 'incomeSources', 'benefits', 'annualSpendingRealAtRetirement']) {
      expect(scenario).not.toHaveProperty(field);
    }
  });

  it('is a no-op on already-migrated v4 data', () => {
    const once = migrateStorageBlob(v3Blob(), 3);
    const twice = migrateStorageBlob(once, 4);
    expect(twice).toEqual(once);
  });
});

describe('v4 -> v5 migration', () => {
  it('adds shared accounts and a surplus destination without disturbing existing data', () => {
    const migrated = migrateStorageBlob(v3Blob(), 3);
    const bundle = ExportBundleSchema.parse(migrated);
    const scenario = bundle.scenarios[0];

    expect(scenario.sharedAccountBuckets).toEqual([]);
    expect(scenario.persons.every((p) => p.surplusDestinationAccountBucketId === null)).toBe(true);
    // The v3->v4 split is untouched by the new step.
    expect(scenario.persons[0].accountBuckets).toHaveLength(4);
    expect(scenario.persons[1].accountBuckets).toHaveLength(0);
  });

  it('leaves an already-v5 scenario alone', () => {
    const once = migrateStorageBlob(v3Blob(), 3);
    const twice = migrateStorageBlob(once, 5);
    expect(twice).toEqual(once);
  });
});

describe('v5 -> v6 migration', () => {
  // The age gate stopped being stored per account in v7 and is read off the
  // KIND instead, so these assert the resolved gate rather than a saved field.
  it('leaves Canadian registered accounts ungated', () => {
    const bundle = ExportBundleSchema.parse(migrateStorageBlob(v3Blob(), 3));
    const buckets = bundle.scenarios[0].persons[0].accountBuckets;

    expect(availableFromAgeFor(buckets.find((b) => b.kind === 'CA_RRSP_RRIF')!)).toBeNull();
    expect(availableFromAgeFor(buckets.find((b) => b.kind === 'CA_TFSA')!)).toBeNull();
    expect(availableFromAgeFor(buckets.find((b) => b.kind === 'CA_CASH_POOL')!)).toBeNull();
  });

  it('gates US registered accounts at 59.5', () => {
    const blob = v3Blob();
    blob.scenarios[0].accountBuckets.push({
      id: 'bucket-401k',
      label: '401(k)',
      country: 'US',
      kind: 'US_TRADITIONAL_401K_IRA',
      taxTreatment: 'taxDeferred',
      startingBalance: 250_000,
      preRetirementReturnPct: 7,
      postRetirementReturnPct: 5,
    });

    const bundle = ExportBundleSchema.parse(migrateStorageBlob(blob, 3));
    const traditional = bundle.scenarios[0].persons[0].accountBuckets.find((b) => b.kind === 'US_TRADITIONAL_401K_IRA')!;
    expect(availableFromAgeFor(traditional)).toBe(59.5);
  });

  it('collapses per-account return rates into one scenario-level pair per group', () => {
    // The fixture is the ordinary case: cash at 2/2, the three investments all
    // at 7/5. Those figures have to survive the collapse untouched, or every
    // migrated projection shifts.
    const bundle = ExportBundleSchema.parse(migrateStorageBlob(v3Blob(), 3));
    expect(bundle.scenarios[0].returnRates).toEqual({
      investmentsPreRetirementPct: 7,
      investmentsPostRetirementPct: 5,
      cashPreRetirementPct: 2,
      cashPostRetirementPct: 2,
    });
  });

  it('takes the majority rate when accounts within a group disagree', () => {
    // Two investments at 7 and one outlier at 3: the pair most accounts
    // already agreed on wins, rather than whichever happens to be first.
    const blob = v3Blob();
    blob.scenarios[0].accountBuckets.find((b: { id: string }) => b.id === 'bucket-tfsa')!.preRetirementReturnPct = 3;

    const bundle = ExportBundleSchema.parse(migrateStorageBlob(blob, 3));
    expect(bundle.scenarios[0].returnRates.investmentsPreRetirementPct).toBe(7);
  });

  it('falls back to the defaults when a group has no accounts to derive from', () => {
    const blob = v3Blob();
    // Cash-flagged accounts removed entirely, so nothing sets the cash pair.
    blob.scenarios[0].accountBuckets = blob.scenarios[0].accountBuckets.filter((b: { isCashBuffer?: boolean }) => !b.isCashBuffer);
    blob.scenarios[0].waterfall = blob.scenarios[0].waterfall.filter((w: { accountBucketId: string }) => w.accountBucketId !== 'bucket-cash');
    blob.scenarios[0].cashBufferRule.replenishmentOrder = [];

    const bundle = ExportBundleSchema.parse(migrateStorageBlob(blob, 3));
    expect(bundle.scenarios[0].returnRates.cashPreRetirementPct).toBe(DEFAULT_RETURN_RATES.cashPreRetirementPct);
    expect(bundle.scenarios[0].returnRates.cashPostRetirementPct).toBe(DEFAULT_RETURN_RATES.cashPostRetirementPct);
  });

  it('drops the per-account rate fields rather than leaving them to drift', () => {
    const bundle = ExportBundleSchema.parse(migrateStorageBlob(v3Blob(), 3));
    for (const bucket of bundle.scenarios[0].persons[0].accountBuckets) {
      expect(bucket).not.toHaveProperty('preRetirementReturnPct');
      expect(bucket).not.toHaveProperty('postRetirementReturnPct');
      expect(bucket).not.toHaveProperty('availableFromAge');
    }
  });

  it('sums per-person spending into one household budget', () => {
    const scenario = ExportBundleSchema.parse(migrateStorageBlob(v3Blob(), 3)).scenarios[0];
    expect(scenario.householdSpendingRealBeforeRetirement).toBe(40_000);
    expect(scenario.householdSpendingRealAtRetirement).toBe(60_000);
  });

  it('derives the household withdrawal order from the old per-person waterfall', () => {
    // The order was the one thing the old file expressed about drawdown, so it
    // has to survive: bucket ids map to their kinds, de-duplicated in place.
    const scenario = ExportBundleSchema.parse(migrateStorageBlob(v3Blob(), 3)).scenarios[0];
    expect(scenario.householdWithdrawalOrder.slice(0, 3)).toEqual(['CA_CASH_POOL', 'CA_RRSP_RRIF', 'CA_TFSA']);
  });

  it('appends kinds the old waterfall never mentioned rather than dropping them', () => {
    // A kind missing from the order means "never draw this for spending" - far
    // too destructive to infer from a file that had no way to say it.
    const scenario = ExportBundleSchema.parse(migrateStorageBlob(v3Blob(), 3)).scenarios[0];
    expect(new Set(scenario.householdWithdrawalOrder).size).toBe(8);
  });

  it('starts a migrated scenario with no availability-age overrides', () => {
    const scenario = ExportBundleSchema.parse(migrateStorageBlob(v3Blob(), 3)).scenarios[0];
    expect(scenario.accountAvailabilityAges).toEqual({});
  });

  it('adds a disabled shared cash-buffer rule', () => {
    const bundle = ExportBundleSchema.parse(migrateStorageBlob(v3Blob(), 3));
    expect(bundle.scenarios[0].sharedCashBufferRule).toEqual({ enabled: false, targetAccountBucketId: null, targetMonthsOfSpending: 6 });
  });

  it('leaves an already-v6 scenario alone', () => {
    const once = migrateStorageBlob(v3Blob(), 3);
    const twice = migrateStorageBlob(once, 6);
    expect(twice).toEqual(once);
  });
});
