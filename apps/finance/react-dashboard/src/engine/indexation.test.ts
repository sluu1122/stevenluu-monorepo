import { describe, expect, it } from 'vitest';
import { buildScenarioLedger } from './ledger';
import { createDefaultScenario } from './defaults';
import { calculateTotalTax, indexTaxConfig } from './calculateTax';
import { availableFromAgeFor, indexedContributionAmount } from './accountKindMeta';
import { OAS_CLAWBACK_THRESHOLD_2025 } from './benefitDefaults';
import type { AccountBucket, Scenario } from './schema';

const startYear = new Date().getFullYear();

describe('indexTaxConfig', () => {
  const base = createDefaultScenario('CA').taxConfig;

  it('scales every dollar threshold and leaves the rates alone', () => {
    const indexed = indexTaxConfig(base, 2);

    expect(indexed.federalTable.standardDeductionOrBPA).toBeCloseTo(base.federalTable.standardDeductionOrBPA * 2, 6);
    indexed.federalTable.brackets.forEach((bracket, i) => {
      const original = base.federalTable.brackets[i];
      expect(bracket.rate).toBe(original.rate);
      expect(bracket.min).toBeCloseTo(original.min * 2, 6);
      if (original.max === null) expect(bracket.max).toBeNull();
      else expect(bracket.max).toBeCloseTo(original.max * 2, 6);
    });
    // Provincial brackets index on the same basis, and its RATES stay put -
    // a 5.06% bracket stays 5.06%, it just starts higher.
    indexed.stateOrProvincialTable.brackets.forEach((bracket, i) => {
      const original = base.stateOrProvincialTable.brackets[i];
      expect(bracket.rate).toBe(original.rate);
      expect(bracket.min).toBeCloseTo(original.min * 2, 6);
    });
    expect(indexed.stateOrProvincialTable.basicPersonalAmount).toBeCloseTo(base.stateOrProvincialTable.basicPersonalAmount * 2, 6);
  });

  it('is a no-op at a factor of 1, returning the config untouched', () => {
    expect(indexTaxConfig(base, 1)).toBe(base);
  });

  it('leaves the effective tax rate unchanged when income and thresholds scale together', () => {
    // The property the whole feature rests on: a progressive table is
    // homogeneous, so doubling income AND every threshold doubles the tax
    // exactly - the real burden is flat rather than creeping upward.
    const flat = calculateTotalTax(80_000, base);
    const doubled = calculateTotalTax(160_000, indexTaxConfig(base, 2));

    expect(doubled.total).toBeCloseTo(flat.total * 2, 6);
    expect(doubled.total / 160_000).toBeCloseTo(flat.total / 80_000, 10);
  });

  it('lets the effective rate climb when thresholds stay frozen', () => {
    // The bug being fixed, stated as a test: same doubled income against the
    // ORIGINAL table pays more than twice the tax.
    const flat = calculateTotalTax(80_000, base);
    const frozen = calculateTotalTax(160_000, base);

    expect(frozen.total).toBeGreaterThan(flat.total * 2);
    expect(frozen.total / 160_000).toBeGreaterThan(flat.total / 80_000);
  });
});

describe('indexedContributionAmount', () => {
  const tfsa = { kind: 'CA_TFSA', annualContributionWhileWorking: 7_000, indexContributionToInflation: true } as const;

  it('returns the amount untouched when indexing is off', () => {
    expect(indexedContributionAmount({ ...tfsa, indexContributionToInflation: false }, 2)).toBe(7_000);
    expect(indexedContributionAmount({ ...tfsa, indexContributionToInflation: undefined }, 2)).toBe(7_000);
  });

  it('steps a TFSA in 500s rather than creeping up every year', () => {
    // A real TFSA limit sits flat for a year or two and then jumps, because
    // it's legislated to round to the nearest 500.
    const at = (years: number) => indexedContributionAmount(tfsa, Math.pow(1.025, years));
    expect([at(0), at(1), at(2), at(3), at(4), at(5)]).toEqual([7_000, 7_000, 7_500, 7_500, 7_500, 8_000]);
  });

  it('indexes an unlimited account smoothly, since no statutory step applies', () => {
    const nonRegistered = { kind: 'CA_NON_REGISTERED', annualContributionWhileWorking: 10_000, indexContributionToInflation: true } as const;
    expect(indexedContributionAmount(nonRegistered, 1.025)).toBeCloseTo(10_250, 6);
  });

  it('leaves a zero contribution at zero', () => {
    expect(indexedContributionAmount({ ...tfsa, annualContributionWhileWorking: 0 }, 4)).toBe(0);
  });
});

/**
 * Turns non-registered account taxation off for a fixture measuring something
 * else. Distributions and realized gains are real taxable income, so leaving
 * them on would fold whatever the seeded accounts throw off into an assertion
 * that is about a different mechanism entirely.
 */
function withoutTaxableAccountTax(scenario: Scenario): void {
  scenario.taxableAccountTaxation = { ...scenario.taxableAccountTaxation, enabled: false };
}

describe('indexation across a projection', () => {
  /** A retiree whose only income is a pension growing at exactly the inflation rate. */
  function pensionScenario(): Scenario {
    const scenario = createDefaultScenario('CA');
    scenario.inflation = { mode: 'flat', flatRatePct: 2.5 };
    scenario.returnRates = { investmentsPreRetirementPct: 0, investmentsPostRetirementPct: 0, cashPct: 0 };

    // Non-registered distributions scale with BALANCES, which grow at the
    // return rate rather than with inflation, so they would break the
    // real-terms-flat property this fixture exists to demonstrate.
    withoutTaxableAccountTax(scenario);

    const person = scenario.persons[0];
    person.retirementStartYear = startYear;
    person.planningEndAge = startYear - person.birthYear + 20;
    person.annualIncomeNominal = 0;
    scenario.householdSpendingRealAtRetirement = 0;
    person.benefits = [];
    person.cashBufferRule = { enabled: false, targetMonthsOfSpending: 6, replenishmentOrder: [] };
    for (const b of person.accountBuckets) b.annualContributionWhileWorking = 0;
    person.incomeSources = [{ id: 'pension', label: 'Pension', startYear, annualAmountNominal: 100_000, growthRatePct: 2.5 }];
    return scenario;
  }

  it('holds the real tax bill flat when a real-terms-constant income meets indexed thresholds', () => {
    const scenario = pensionScenario();
    const rows = buildScenarioLedger(scenario, [])[0].result.rows;

    const realTax = rows.map((r, i) => r.taxesPaid.total / Math.pow(1.025, i));
    for (const value of realTax) expect(value).toBeCloseTo(realTax[0], 4);
  });

  it('drags that same income into higher brackets when indexing is switched off', () => {
    const scenario = pensionScenario();
    scenario.indexTaxThresholdsToInflation = false;
    const rows = buildScenarioLedger(scenario, [])[0].result.rows;

    const realTax = rows.map((r, i) => r.taxesPaid.total / Math.pow(1.025, i));
    // Year one is identical either way - the factor is 1 - and every year
    // after costs strictly more in real terms.
    expect(realTax[0]).toBeCloseTo(realTax[0], 6);
    expect(realTax[realTax.length - 1]).toBeGreaterThan(realTax[0] * 1.05);
    for (let i = 1; i < realTax.length; i++) expect(realTax[i]).toBeGreaterThan(realTax[i - 1]);
  });

  it('indexes the OAS clawback threshold so a flat real income is not progressively clawed back', () => {
    // Income parked just under the threshold in today's money. Frozen, it
    // crosses within a few years on inflation alone and OAS starts vanishing.
    const build = (indexed: boolean) => {
      const scenario = pensionScenario();
      scenario.indexTaxThresholdsToInflation = indexed;
      const person = scenario.persons[0];
      person.incomeSources = [
        { id: 'pension', label: 'Pension', startYear, annualAmountNominal: OAS_CLAWBACK_THRESHOLD_2025 - 5_000, growthRatePct: 2.5 },
      ];
      person.benefits = [{ type: 'CA_OAS', claimAge: 65, monthlyBenefitAtClaimAge: 743, colaPct: 2.5 }];
      person.birthYear = startYear - 65; // claiming from the first projected year
      person.planningEndAge = 85;
      // RRIF minimums would start at 72 and add taxable income of their own,
      // which moves the clawback for a reason that has nothing to do with
      // indexing. Off, so the threshold is the only thing under test.
      person.requiredDistributionRule = { enabled: false, startAgeOverride: null, destinationAccountBucketId: null };
      return buildScenarioLedger(scenario, [])[0].result.rows;
    };

    const oasOf = (row: { benefits: { type: string; amount: number }[] }) => row.benefits.find((b) => b.type === 'CA_OAS')?.amount ?? 0;

    const indexedRows = build(true);
    const frozenRows = build(false);

    const realOf = (rows: typeof indexedRows) => rows.map((r, i) => oasOf(r) / Math.pow(1.025, i));
    // Measured from the THIRD year on. The clawback tests against the prior
    // tax year's income, so year one is unclawed (no prior year) and year two
    // is clawed against an unclawed year - it settles from there.
    const indexedReal = realOf(indexedRows).slice(2);
    const frozenReal = realOf(frozenRows);

    // Indexed: a flat real income keeps a flat real OAS. It settles rather
    // than snapping flat, because each year's clawback is computed from a
    // prior year that was itself clawed back - a damped iteration that
    // converges within a few years and then holds exactly.
    const settled = indexedReal.slice(-5);
    for (const value of settled) expect(value).toBeCloseTo(settled[0], 4);
    for (const value of indexedReal) expect(Math.abs(value / settled[0] - 1)).toBeLessThan(0.002);

    // Frozen: the same plan bleeds OAS every single year, purely because
    // inflation carries an unchanged real income over an unchanged threshold.
    for (let i = 3; i < frozenReal.length; i++) expect(frozenReal[i]).toBeLessThan(frozenReal[i - 1]);
    expect(frozenReal[frozenReal.length - 1]).toBeLessThan(indexedReal[0] * 0.5);
  });

  it('steps an indexed TFSA contribution up over the projection, funded from cash', () => {
    const scenario = createDefaultScenario('CA');
    scenario.inflation = { mode: 'flat', flatRatePct: 2.5 };
    scenario.returnRates = { investmentsPreRetirementPct: 0, investmentsPostRetirementPct: 0, cashPct: 0 };

    const person = scenario.persons[0];
    person.retirementStartYear = null;
    person.planningEndAge = startYear - person.birthYear + 6;
    person.annualIncomeNominal = 0;
    scenario.householdSpendingRealBeforeRetirement = 0;
    person.benefits = [];
    person.cashBufferRule = { enabled: false, targetMonthsOfSpending: 6, replenishmentOrder: [] };

    const cash = person.accountBuckets.find((b) => b.isCashBuffer)!;
    cash.startingBalance = 500_000;
    const tfsa = person.accountBuckets.find((b) => b.kind === 'CA_TFSA')!;
    tfsa.annualContributionWhileWorking = 7_000;
    tfsa.indexContributionToInflation = true;
    for (const b of person.accountBuckets) {
      if (b.id !== tfsa.id) b.annualContributionWhileWorking = 0;
    }

    const rows = buildScenarioLedger(scenario, [])[0].result.rows;
    const contributed = rows.slice(0, 6).map((r) => Math.round(r.contributions[tfsa.id] ?? 0));
    expect(contributed).toEqual([7_000, 7_000, 7_500, 7_500, 7_500, 8_000]);

    // Still funded, not minted: the cash account gave up exactly that much.
    const drawn = rows.slice(0, 6).reduce((sum, r) => sum + (r.withdrawals[cash.id] ?? 0), 0);
    expect(drawn).toBeCloseTo(
      contributed.reduce((a, b) => a + b, 0),
      2,
    );
  });

  it('leaves an unindexed contribution flat, as the figure the user typed', () => {
    const scenario = createDefaultScenario('CA');
    const person = scenario.persons[0];
    person.retirementStartYear = null;
    person.planningEndAge = startYear - person.birthYear + 4;
    scenario.householdSpendingRealBeforeRetirement = 0;
    person.benefits = [];
    person.cashBufferRule = { enabled: false, targetMonthsOfSpending: 6, replenishmentOrder: [] };
    person.accountBuckets.find((b) => b.isCashBuffer)!.startingBalance = 500_000;

    const tfsa = person.accountBuckets.find((b) => b.kind === 'CA_TFSA')!;
    for (const b of person.accountBuckets) b.annualContributionWhileWorking = b.id === tfsa.id ? 7_000 : 0;

    const rows = buildScenarioLedger(scenario, [])[0].result.rows;
    for (const row of rows.slice(0, 4)) expect(row.contributions[tfsa.id] ?? 0).toBeCloseTo(7_000, 6);
  });
});

describe('shared account buckets index too', () => {
  it('indexes a shared account contribution on the same schedule', () => {
    const scenario = createDefaultScenario('CA');
    scenario.inflation = { mode: 'flat', flatRatePct: 2.5 };
    scenario.returnRates = { investmentsPreRetirementPct: 0, investmentsPostRetirementPct: 0, cashPct: 0 };

    const jointCash: AccountBucket = {
      id: 'joint-cash',
      label: 'Joint Cash',
      country: 'CA',
      kind: 'CA_CASH_POOL',
      taxTreatment: 'taxable',
      startingBalance: 400_000,
      isCashBuffer: true,
    };
    const jointSavings: AccountBucket = {
      id: 'joint-savings',
      label: 'Joint Savings',
      country: 'CA',
      kind: 'CA_NON_REGISTERED',
      taxTreatment: 'taxable',
      startingBalance: 0,
      annualContributionWhileWorking: 10_000,
      indexContributionToInflation: true,
    };
    scenario.sharedAccountBuckets = [jointCash, jointSavings];

    const person = scenario.persons[0];
    person.retirementStartYear = null;
    person.planningEndAge = startYear - person.birthYear + 3;
    scenario.householdSpendingRealBeforeRetirement = 0;
    person.benefits = [];
    person.cashBufferRule = { enabled: false, targetMonthsOfSpending: 6, replenishmentOrder: [] };
    for (const b of person.accountBuckets) b.annualContributionWhileWorking = 0;

    const rows = buildScenarioLedger(scenario, [])[0].result.rows;
    // Non-registered has no statutory step, so it tracks inflation smoothly.
    expect(rows[0].contributions[jointSavings.id]).toBeCloseTo(10_000, 2);
    expect(rows[1].contributions[jointSavings.id]).toBeCloseTo(10_250, 2);
    expect(rows[2].contributions[jointSavings.id]).toBeCloseTo(10_506.25, 2);
  });
});

describe('account availability overrides', () => {
  /** A retiree whose only money is in a 401(k), statutorily gated at 59.5. */
  function gatedScenario(age: number) {
    const scenario = createDefaultScenario('US');
    scenario.returnRates = { investmentsPreRetirementPct: 0, investmentsPostRetirementPct: 0, cashPct: 0 };
    scenario.inflation = { mode: 'flat', flatRatePct: 0 };
    const person = scenario.persons[0];
    person.birthYear = startYear - age;
    person.planningEndAge = age + 1;
    person.retirementStartYear = startYear;
    person.benefits = [];
    person.annualIncomeNominal = 0;
    person.cashBufferRule = { enabled: false, targetMonthsOfSpending: 6, replenishmentOrder: [] };
    person.requiredDistributionRule = { enabled: false, startAgeOverride: null, destinationAccountBucketId: null };
    scenario.householdSpendingRealAtRetirement = 40_000;

    const traditional = person.accountBuckets.find((b) => b.kind === 'US_TRADITIONAL_401K_IRA')!;
    for (const bucket of person.accountBuckets) {
      bucket.startingBalance = bucket.id === traditional.id ? 2_000_000 : 0;
      bucket.annualContributionWhileWorking = 0;
    }
    return { scenario, traditional };
  }

  it('gates a 401(k) at the statutory 59.5 when nothing is overridden', () => {
    const { scenario, traditional } = gatedScenario(50);
    const { rows, warnings } = buildScenarioLedger(scenario, [])[0].result;

    expect(rows[0].withdrawals[traditional.id] ?? 0).toBe(0);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('lets a scenario lower the gate so the account becomes reachable', () => {
    const { scenario, traditional } = gatedScenario(50);
    scenario.accountAvailabilityAges = { US_TRADITIONAL_401K_IRA: 45 };
    const { rows, warnings } = buildScenarioLedger(scenario, [])[0].result;

    // At least the spending; the draw also has to carry its own tax, since a
    // 401(k) is the only account left with a balance.
    expect(rows[0].withdrawals[traditional.id]).toBeGreaterThanOrEqual(40_000);
    expect(warnings).toHaveLength(0);
  });

  it('lets a scenario remove the gate entirely with null', () => {
    const { scenario, traditional } = gatedScenario(30);
    scenario.accountAvailabilityAges = { US_TRADITIONAL_401K_IRA: null };
    const { rows, warnings } = buildScenarioLedger(scenario, [])[0].result;

    expect(rows[0].withdrawals[traditional.id]).toBeGreaterThanOrEqual(40_000);
    expect(warnings).toHaveLength(0);
  });

  it('lets a scenario raise the gate above the statutory age', () => {
    const { scenario, traditional } = gatedScenario(62);
    // Reachable at 62 by statute; pushed out of reach by the override.
    expect(buildScenarioLedger(scenario, [])[0].result.rows[0].withdrawals[traditional.id]).toBeGreaterThanOrEqual(40_000);

    scenario.accountAvailabilityAges = { US_TRADITIONAL_401K_IRA: 70 };
    const { rows, warnings } = buildScenarioLedger(scenario, [])[0].result;
    expect(rows[0].withdrawals[traditional.id] ?? 0).toBe(0);
    expect(warnings[0].message).toMatch(/not yet available at age/);
  });

  it('applies the override to cash-buffer replenishment, not just the spending draw', () => {
    // The gate has to hold on every path out of the account, or a plan can
    // reach a locked 401(k) by way of a buffer top-up.
    const { scenario, traditional } = gatedScenario(50);
    const person = scenario.persons[0];
    const cash = person.accountBuckets.find((b) => b.isCashBuffer)!;
    // The 401(k) is the only account the buffer can be filled from, so a
    // credit into cash can only have come through replenishment.
    person.cashBufferRule = { enabled: true, targetMonthsOfSpending: 12, replenishmentOrder: [traditional.id] };

    const gated = buildScenarioLedger(scenario, [])[0].result.rows[0];
    expect(gated.cashBufferReplenishment).toBe(0);
    expect(gated.contributions[cash.id] ?? 0).toBe(0);

    scenario.accountAvailabilityAges = { US_TRADITIONAL_401K_IRA: 45 };
    const open = buildScenarioLedger(scenario, [])[0].result.rows[0];
    expect(open.cashBufferReplenishment).toBeGreaterThan(0);
    expect(open.contributions[cash.id] ?? 0).toBeGreaterThan(0);
  });

  it('leaves other kinds on their statutory ages when one kind is overridden', () => {
    const { scenario } = gatedScenario(50);
    scenario.accountAvailabilityAges = { US_TRADITIONAL_401K_IRA: 45 };
    const roth = scenario.persons[0].accountBuckets.find((b) => b.kind === 'US_ROTH_401K_IRA')!;
    expect(availableFromAgeFor(roth, scenario.accountAvailabilityAges)).toBe(59.5);
  });
});
