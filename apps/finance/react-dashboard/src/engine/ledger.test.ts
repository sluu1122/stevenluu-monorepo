import { describe, expect, it } from 'vitest';
import { buildScenarioLedger } from './ledger';
import { combineLedgers } from './combineLedgers';
import { createDefaultPersonPlan, createDefaultScenario } from './defaults';
import { calculateTotalTax } from './calculateTax';
import { grossUpForNet } from './cashBuffer';
import { availableFromAgeFor } from './accountKindMeta';
import type { AccountBucket, GridOverride, PersonPlan, ReturnRates, Scenario } from './schema';

/**
 * Growth switched off scenario-wide. Rates are one scenario-level setting now,
 * so a test that wants to measure flows rather than compounding says so once
 * here instead of zeroing a pair of fields on every bucket it builds.
 */
const NO_GROWTH: ReturnRates = {
  investmentsPreRetirementPct: 0,
  investmentsPostRetirementPct: 0,
  cashPct: 0,
};

/**
 * Builds one person's ledger out of a full scenario run. Every person is
 * always computed together now (shared accounts are one running balance
 * across persons), so single-person assertions pick their slice out.
 */
function build(scenario: Scenario, personIndex = 0, overrides: GridOverride[] = []) {
  return buildScenarioLedger(scenario, overrides)[personIndex].result;
}

/** A person's ledger identified by id rather than position. */
function buildFor(scenario: Scenario, plan: PersonPlan, overrides: GridOverride[] = []) {
  return buildScenarioLedger(scenario, overrides).find((l) => l.plan.id === plan.id)!.result;
}

/**
 * Sets the household budget. Takes per-person figures for readability at the
 * call sites, which predate spending being pooled, and simply sums them - the
 * household draws as one pot now, so who "owned" a figure no longer matters.
 */
function setSpending(scenario: Scenario, opts: { atRetirement?: number[]; before?: number[] }): void {
  scenario.householdSpendingRealAtRetirement = (opts.atRetirement ?? []).reduce((s, v) => s + v, 0);
  scenario.householdSpendingRealBeforeRetirement = (opts.before ?? []).reduce((s, v) => s + v, 0);
}

/** Same spending for everyone, the common two-person case. */
function setSpendingEach(scenario: Scenario, opts: { atRetirement?: number; before?: number }): void {
  setSpending(scenario, {
    atRetirement: scenario.persons.map(() => opts.atRetirement ?? 0),
    before: scenario.persons.map(() => opts.before ?? 0),
  });
}

/**
 * Turns non-registered account taxation off for a fixture that is measuring
 * something else. Distributions and realized capital gains are real taxable
 * income, so leaving them on would mean an assertion like "this RRSP pull is
 * the person's entire taxable income for the year" was quietly also testing
 * whatever the backstop account threw off. The isolation is deliberate; the
 * taxation itself has its own coverage.
 */
function withoutTaxableAccountTax(scenario: Scenario): void {
  scenario.taxableAccountTaxation = { ...scenario.taxableAccountTaxation, enabled: false };
}

describe('buildScenarioLedger', () => {
  it('produces one row per year from now through planningEndAge', () => {
    const scenario = createDefaultScenario('US');
    const person1 = scenario.persons[0];
    const { rows } = build(scenario);
    const expectedYears = person1.planningEndAge - (new Date().getFullYear() - person1.birthYear) + 1;
    expect(rows).toHaveLength(expectedYears);
    expect(rows[0].year).toBe(new Date().getFullYear());
  });

  it('has zero spending and zero withdrawals before retirement starts and before any benefit is claimable', () => {
    const scenario = createDefaultScenario('US');
    const person1 = scenario.persons[0];
    setSpending(scenario, { atRetirement: [60_000] });
    // Default SS claim age is 67; cap the projection well before that so
    // benefit-driven tax withdrawals (a real, separate behavior - see the
    // next test) don't confound this "no retirement yet" check.
    person1.planningEndAge = new Date().getFullYear() - person1.birthYear + 10;
    // Contributions are paid for out of cash, so a seeded one would show as a
    // withdrawal from the cash buffer - a different behavior from the
    // spending draw this test is about.
    for (const bucket of person1.accountBuckets) bucket.annualContributionWhileWorking = 0;
    const { rows } = build(scenario);
    expect(rows.every((r) => !r.isRetired)).toBe(true);
    expect(rows.every((r) => r.spendingNominal === 0)).toBe(true);
    expect(rows.every((r) => Object.keys(r.withdrawals).length === 0)).toBe(true);
  });

  it('still taxes a claimed benefit even if no retirement year has been set', () => {
    const scenario = createDefaultScenario('US');
    const person1 = scenario.persons[0];
    const ssBenefit = person1.benefits.find((b) => b.type === 'US_SOCIAL_SECURITY')!;
    const currentAge = new Date().getFullYear() - person1.birthYear;
    person1.planningEndAge = ssBenefit.claimAge + 2;
    // Thresholds held still, so the benefit is measured against today's
    // standard deduction rather than one indexed 30 years forward - by then a
    // 26,400 benefit sits below it and owes nothing, which would make this
    // test pass or fail on the deduction rather than on what it is about.
    scenario.indexTaxThresholdsToInflation = false;
    const { rows } = build(scenario);

    const beforeClaim = rows.filter((r) => r.age < ssBenefit.claimAge);
    const afterClaim = rows.filter((r) => r.age >= ssBenefit.claimAge);
    expect(currentAge).toBeLessThan(ssBenefit.claimAge);
    expect(beforeClaim.every((r) => r.benefits.length === 0)).toBe(true);
    expect(afterClaim.every((r) => r.benefits.length > 0)).toBe(true);
    expect(afterClaim.every((r) => !r.isRetired)).toBe(true);
    expect(afterClaim.every((r) => r.taxesPaid.total > 0)).toBe(true);
  });

  it('starts spending and drawing down once a retirement year is set, growing net worth pre-retirement', () => {
    const scenario = createDefaultScenario('US');
    const person1 = scenario.persons[0];
    const startYear = new Date().getFullYear();
    person1.retirementStartYear = startYear + 5;
    const { rows } = build(scenario);

    const preRetirementRows = rows.filter((r) => !r.isRetired);
    const retirementRows = rows.filter((r) => r.isRetired);
    expect(preRetirementRows).toHaveLength(5);
    expect(retirementRows.length).toBeGreaterThan(0);

    // Net worth should grow pre-retirement given positive default return/contribution assumptions.
    expect(preRetirementRows.at(-1)!.totalNetWorth).toBeGreaterThan(preRetirementRows[0].totalNetWorth);

    // First retirement year's nominal spending equals the real target (no inflation compounded yet).
    expect(retirementRows[0].spendingNominal).toBeCloseTo(scenario.householdSpendingRealAtRetirement, 5);
  });

  it("resolves each person's benefit claim age against their own birth year", () => {
    const scenario = createDefaultScenario('CA');
    const person1 = scenario.persons[0];
    const person2 = createDefaultPersonPlan('CA', 'Person 2');
    person2.birthYear = person1.birthYear - 5; // person 2 is 5 years older
    scenario.persons.push(person2);

    const cpp = person2.benefits.find((b) => b.type === 'CA_CPP')!;
    cpp.claimAge = 65;
    person2.benefits = [cpp];
    person1.planningEndAge = person2.birthYear + cpp.claimAge - person1.birthYear + 2;

    const { rows } = build(scenario, 1);
    const person2ClaimYear = person2.birthYear + cpp.claimAge;

    const before = rows.filter((r) => r.year < person2ClaimYear);
    const after = rows.filter((r) => r.year >= person2ClaimYear);
    expect(before.every((r) => !r.benefits.some((b) => b.type === 'CA_CPP'))).toBe(true);
    expect(after.some((r) => r.benefits.some((b) => b.type === 'CA_CPP'))).toBe(true);
    // Person 2's own row shows their own age, which is 65 at their claim year.
    expect(rows.find((r) => r.year === person2ClaimYear)!.age).toBe(cpp.claimAge);
  });

  it("claws back OAS using the PRIOR year's taxable income, not the current year's", () => {
    const scenario = createDefaultScenario('CA');
    const person1 = scenario.persons[0];
    const currentAge = new Date().getFullYear() - person1.birthYear;
    const oas = person1.benefits.find((b) => b.type === 'CA_OAS')!;
    oas.claimAge = currentAge; // claimable starting the very first projected year
    person1.planningEndAge = currentAge + 3;
    // A huge income source active only in year 1 pushes that year's taxable
    // income far past the clawback threshold, with nothing to claw back yet
    // (no prior year exists) - year 2 should then show the clawback.
    const firstYear = new Date().getFullYear();
    person1.incomeSources = [
      { id: 'big-income', label: 'One-time income', startYear: firstYear, endYear: firstYear, annualAmountNominal: 500_000, growthRatePct: 0 },
    ];

    const { rows } = build(scenario);
    const year1 = rows.find((r) => r.year === firstYear)!;
    const year2 = rows.find((r) => r.year === firstYear + 1)!;

    const oasAmountYear1 = year1.benefits.find((b) => b.type === 'CA_OAS')?.amount ?? 0;
    const oasAmountYear2 = year2.benefits.find((b) => b.type === 'CA_OAS')?.amount ?? 0;

    expect(oasAmountYear1).toBeCloseTo(oas.monthlyBenefitAtClaimAge * 12, 5); // full amount - no prior year to claw back from
    expect(oasAmountYear2).toBeLessThan(oasAmountYear1); // year 2 pays for year 1's high income
  });

  it("stops a person's income exactly at their own retirement start year", () => {
    const scenario = createDefaultScenario('US');
    const person1 = scenario.persons[0];
    const startYear = new Date().getFullYear();
    person1.annualIncomeNominal = 100_000;
    person1.incomeGrowthRatePct = 0;
    person1.retirementStartYear = startYear + 3;
    person1.planningEndAge = new Date().getFullYear() - person1.birthYear + 10;

    const { rows } = build(scenario);
    const beforeRetirement = rows.filter((r) => r.year < startYear + 3);
    const afterRetirement = rows.filter((r) => r.year >= startYear + 3);

    expect(beforeRetirement.every((r) => r.incomes.find((i) => i.sourceId === person1.id)!.amount === 100_000)).toBe(true);
    expect(afterRetirement.every((r) => r.incomes.find((i) => i.sourceId === person1.id)!.amount === 0)).toBe(true);
  });

  it('extends the projection horizon to cover whichever person has the latest birthYear + planningEndAge', () => {
    const scenario = createDefaultScenario('US');
    const person1 = scenario.persons[0];
    person1.planningEndAge = 70; // shorter than the younger person below
    const youngerPerson = createDefaultPersonPlan('US', 'Person 2');
    youngerPerson.birthYear = person1.birthYear + 20; // 20 years younger
    youngerPerson.planningEndAge = 90;
    scenario.persons.push(youngerPerson);

    const { rows } = build(scenario);
    const lastRow = rows.at(-1)!;
    const expectedHorizonEndYear = Math.max(person1.birthYear + person1.planningEndAge, youngerPerson.birthYear + youngerPerson.planningEndAge);
    expect(lastRow.year).toBe(expectedHorizonEndYear);
    // Person 1's row still shows Person 1's age, even past their own planningEndAge.
    expect(lastRow.age).toBe(expectedHorizonEndYear - person1.birthYear);
  });

  it('withdraws to fund spending before retirement when annualSpendingRealBeforeRetirement is set', () => {
    const scenario = createDefaultScenario('US');
    const person1 = scenario.persons[0];
    person1.planningEndAge = new Date().getFullYear() - person1.birthYear + 2;
    setSpending(scenario, { before: [20_000] });

    const { rows } = build(scenario);

    expect(rows[0].isRetired).toBe(false);
    expect(rows[0].spendingNominal).toBeCloseTo(20_000, 5);
    expect(Object.keys(rows[0].withdrawals).length).toBeGreaterThan(0);
  });

  it('funds taxes from income surplus before withdrawing from buckets, and banks any leftover surplus in the cash buffer', () => {
    const scenario = createDefaultScenario('US');
    const person1 = scenario.persons[0];
    const cashBucket = person1.accountBuckets.find((b) => b.isCashBuffer)!;
    person1.annualIncomeNominal = 80_000;
    person1.incomeGrowthRatePct = 0;
    person1.planningEndAge = new Date().getFullYear() - person1.birthYear + 1;
    setSpending(scenario, { before: [20_000] }); // well below income
    // Isolated from contribution funding, which draws on that same cash
    // buffer - covered on its own in 'funded contributions'.
    for (const bucket of person1.accountBuckets) bucket.annualContributionWhileWorking = 0;

    const { rows } = build(scenario);
    const firstRow = rows[0];

    expect(firstRow.taxesPaid.total).toBeGreaterThan(0);
    expect(Object.keys(firstRow.withdrawals)).toHaveLength(0); // tax funded by income, nothing sold from buckets
    expect(firstRow.contributions[cashBucket.id]).toBeCloseTo(80_000 - 20_000 - firstRow.taxesPaid.total, 5);
  });

  it('does not bank a surplus or reduce bucket withdrawals when income falls short of spending', () => {
    const scenario = createDefaultScenario('US');
    const person1 = scenario.persons[0];
    const cashBucket = person1.accountBuckets.find((b) => b.isCashBuffer)!;
    person1.annualIncomeNominal = 10_000;
    person1.incomeGrowthRatePct = 0;
    person1.planningEndAge = new Date().getFullYear() - person1.birthYear + 1;
    setSpending(scenario, { before: [50_000] }); // exceeds income

    const { rows } = build(scenario);
    const firstRow = rows[0];

    expect(firstRow.contributions[cashBucket.id] ?? 0).toBe(0);
    expect(Object.keys(firstRow.withdrawals).length).toBeGreaterThan(0);
  });

  it("converts an account bucket's balance into the scenario's selected currency using the bucket's own country as its native currency", () => {
    const scenario = createDefaultScenario('CA');
    const person1 = scenario.persons[0];
    person1.planningEndAge = new Date().getFullYear() - person1.birthYear + 1;
    scenario.exchangeRateUsdToCad = 1.4;

    const usBucket: AccountBucket = {
      id: 'us-bucket',
      label: 'US Brokerage',
      country: 'US',
      kind: 'US_TAXABLE_BROKERAGE',
      taxTreatment: 'taxable',
      startingBalance: 1_000,
    };
    person1.accountBuckets.push(usBucket);

    const { rows } = build(scenario);

    // Scenario currency is CAD (from createDefaultScenario('CA')) - the US
    // bucket's native USD balance must be converted, not summed raw.
    expect(rows[0].accountStart[usBucket.id]).toBeCloseTo(1_000 * 1.4, 5);
  });

  it('applies a GridOverride for spendingNominal without disturbing other years', () => {
    const scenario = createDefaultScenario('US');
    const person1 = scenario.persons[0];
    const startYear = new Date().getFullYear();
    person1.retirementStartYear = startYear;
    // Comfortably funded either way: an override big enough to exhaust the
    // accounts would necessarily change later years, since it spent the money.
    person1.accountBuckets.find((b) => b.isCashBuffer)!.startingBalance = 5_000_000;
    const overrideYear = startYear + 2;

    const { rows: baseline } = build(scenario);
    const { rows: withOverride } = build(scenario, 0, [
      {
        id: 'o1',
        scenarioId: scenario.id,
        personId: person1.id,
        year: overrideYear,
        field: 'spendingNominal',
        value: 90_000,
        note: undefined,
        createdAt: new Date().toISOString(),
      },
    ]);

    const overriddenRow = withOverride.find((r) => r.year === overrideYear)!;
    // The override raises the household budget; spendingNominal reports what
    // was actually funded, so a budget past what the accounts hold shows up as
    // a bigger draw plus a shortfall rather than as the raw figure.
    const baselineRow = baseline.find((r) => r.year === overrideYear)!;
    expect(overriddenRow.spendingNominal).toBeGreaterThan(baselineRow.spendingNominal);
    expect(overriddenRow.spendingNominal).toBeCloseTo(90_000, 5);
    expect(overriddenRow.overriddenFields).toContain('spendingNominal');

    const nextYearBaseline = baseline.find((r) => r.year === overrideYear + 1)!;
    const nextYearOverridden = withOverride.find((r) => r.year === overrideYear + 1)!;
    expect(nextYearOverridden.spendingNominal).toBeCloseTo(nextYearBaseline.spendingNominal, 5);
  });

  it("ignores another person's GridOverride", () => {
    const scenario = createDefaultScenario('US');
    const person1 = scenario.persons[0];
    const person2 = createDefaultPersonPlan('US', 'Person 2');
    scenario.persons.push(person2);
    const startYear = new Date().getFullYear();
    person1.retirementStartYear = startYear;

    const { rows } = build(scenario, 0, [
      {
        id: 'o1',
        scenarioId: scenario.id,
        personId: person2.id,
        year: startYear,
        field: 'spendingNominal',
        value: 999_999,
        note: undefined,
        createdAt: new Date().toISOString(),
      },
    ]);

    expect(rows[0].spendingNominal).not.toBe(999_999);
    expect(rows[0].overriddenFields).toHaveLength(0);
  });
});

describe('per-person tax isolation', () => {
  /** The bug this refactor exists to fix: one person's salary consuming another's meltdown headroom. */
  it("leaves a zero-income person's full meltdown ceiling available even when another person earns a large salary", () => {
    const scenario = createDefaultScenario('CA');
    const startYear = new Date().getFullYear();

    const retiree = scenario.persons[0];
    retiree.retirementStartYear = startYear;
    retiree.annualIncomeNominal = 0;
    setSpending(scenario, { atRetirement: [0] }); // isolate the meltdown from ordinary spending
    retiree.benefits = []; // no benefit income either - taxable income starts at exactly 0
    withoutTaxableAccountTax(scenario); // ...and no distributions from the seeded non-registered account
    retiree.planningEndAge = startYear - retiree.birthYear + 2;
    const rrsp = retiree.accountBuckets.find((b) => b.kind === 'CA_RRSP_RRIF')!;
    const tfsa = retiree.accountBuckets.find((b) => b.kind === 'CA_TFSA')!;
    retiree.meltdownRules = [
      { accountBucketId: rrsp.id, enabled: true, targetTaxableIncomeCeiling: 60_000, startYear, endYear: null, destinationAccountBucketId: tfsa.id },
    ];

    const earner = createDefaultPersonPlan('CA', 'Person 2');
    earner.annualIncomeNominal = 90_000;
    earner.incomeGrowthRatePct = 0;
    scenario.persons.push(earner);

    const { rows } = buildFor(scenario, retiree);

    // The full $60,000 ceiling is available: Person 2's $90,000 salary is
    // taxed on Person 2's own return and never touches this one.
    expect(rows[0].meltdownWithdrawalTotal).toBeCloseTo(60_000, 5);
    expect(rows[0].incomes.reduce((sum, i) => sum + i.amount, 0)).toBe(0);
  });

  it("does not leak one person's spending, benefits or accounts into another's ledger", () => {
    const scenario = createDefaultScenario('US');
    const person1 = scenario.persons[0];
    const person2 = createDefaultPersonPlan('US', 'Person 2');
    person1.planningEndAge = new Date().getFullYear() - person1.birthYear + 1;
    person2.benefits = [];
    scenario.persons.push(person2);
    // After the push - shares are assigned across whoever is in the household.
    setSpending(scenario, { before: [50_000, 0] });

    const p1 = buildFor(scenario, person1).rows[0];
    const p2 = buildFor(scenario, person2).rows[0];

    // Pooled now: the budget is funded from the household's accounts, so both
    // people carry part of it and the two together come back to the budget.
    expect(p1.spendingNominal + p2.spendingNominal).toBeCloseTo(50_000, 5);
    // Each row only ever carries its own person's bucket ids.
    expect(Object.keys(p1.accountEnd).every((id) => person1.accountBuckets.some((b) => b.id === id))).toBe(true);
    expect(Object.keys(p2.accountEnd).every((id) => person2.accountBuckets.some((b) => b.id === id))).toBe(true);
  });
});

describe('meltdown rules', () => {
  function meltdownScenario(): { scenario: Scenario; person: PersonPlan } {
    const scenario = createDefaultScenario('CA');
    scenario.returnRates = { ...NO_GROWTH };
    withoutTaxableAccountTax(scenario);
    const person = scenario.persons[0];
    const startYear = new Date().getFullYear();
    person.retirementStartYear = startYear;
    setSpending(scenario, { atRetirement: [0] });
    person.benefits = [];
    person.planningEndAge = startYear - person.birthYear + 4;
    return { scenario, person };
  }

  it('melts down only within the configured window, reinvesting the after-tax surplus', () => {
    const { scenario, person } = meltdownScenario();
    const startYear = new Date().getFullYear();
    const rrsp = person.accountBuckets.find((b) => b.kind === 'CA_RRSP_RRIF')!;
    const tfsa = person.accountBuckets.find((b) => b.kind === 'CA_TFSA')!;
    person.meltdownRules = [
      {
        accountBucketId: rrsp.id,
        enabled: true,
        targetTaxableIncomeCeiling: 40_000,
        startYear,
        endYear: startYear + 1,
        destinationAccountBucketId: tfsa.id,
      },
    ];

    const { rows } = buildFor(scenario, person);
    const inWindow = rows.filter((r) => r.year <= startYear + 1);
    const afterWindow = rows.filter((r) => r.year > startYear + 1);

    expect(inWindow.every((r) => r.meltdownWithdrawalTotal > 0)).toBe(true);
    expect(afterWindow.every((r) => r.meltdownWithdrawalTotal === 0)).toBe(true);

    // The withdrawal must show up against the RRSP bucket and the after-tax
    // surplus must land in the TFSA (contributions), not just vanish.
    const firstWindowRow = inWindow[0];
    expect(firstWindowRow.withdrawals[rrsp.id]).toBeGreaterThanOrEqual(firstWindowRow.meltdownWithdrawalTotal);
    expect(firstWindowRow.contributions[tfsa.id]).toBeGreaterThan(0);
    expect(firstWindowRow.contributions[tfsa.id]).toBeLessThan(firstWindowRow.meltdownWithdrawalTotal); // net of tax

    // Melting down triggers real tax that wouldn't otherwise exist (spending is 0).
    expect(firstWindowRow.taxesPaid.total).toBeGreaterThan(0);
  });

  it('fills a shared ceiling jointly across two rules rather than once each', () => {
    const { scenario, person } = meltdownScenario();
    const startYear = new Date().getFullYear();
    const rrsp = person.accountBuckets.find((b) => b.kind === 'CA_RRSP_RRIF')!;
    const tfsa = person.accountBuckets.find((b) => b.kind === 'CA_TFSA')!;
    // A second tax-deferred account so there are genuinely two rules.
    const secondRrsp: AccountBucket = { ...rrsp, id: 'rrsp-2', label: 'Spousal RRSP', startingBalance: 200_000 };
    person.accountBuckets.push(secondRrsp);

    person.meltdownRules = [
      { accountBucketId: rrsp.id, enabled: true, targetTaxableIncomeCeiling: 50_000, startYear, endYear: null, destinationAccountBucketId: tfsa.id },
      { accountBucketId: secondRrsp.id, enabled: true, targetTaxableIncomeCeiling: 50_000, startYear, endYear: null, destinationAccountBucketId: tfsa.id },
    ];

    const { rows } = buildFor(scenario, person);
    // Both rules name a $50,000 ceiling; together they fill to $50,000 - not $100,000.
    expect(rows[0].meltdownWithdrawalTotal).toBeCloseTo(50_000, 5);
  });

  it('lets a higher second ceiling top up beyond what the first rule withdrew', () => {
    const { scenario, person } = meltdownScenario();
    const startYear = new Date().getFullYear();
    const rrsp = person.accountBuckets.find((b) => b.kind === 'CA_RRSP_RRIF')!;
    const tfsa = person.accountBuckets.find((b) => b.kind === 'CA_TFSA')!;
    const secondRrsp: AccountBucket = { ...rrsp, id: 'rrsp-2', label: 'Spousal RRSP', startingBalance: 200_000 };
    person.accountBuckets.push(secondRrsp);

    person.meltdownRules = [
      { accountBucketId: rrsp.id, enabled: true, targetTaxableIncomeCeiling: 30_000, startYear, endYear: null, destinationAccountBucketId: tfsa.id },
      { accountBucketId: secondRrsp.id, enabled: true, targetTaxableIncomeCeiling: 80_000, startYear, endYear: null, destinationAccountBucketId: tfsa.id },
    ];

    const { rows } = buildFor(scenario, person);
    expect(rows[0].meltdownWithdrawalTotal).toBeCloseTo(80_000, 5);
    expect(rows[0].withdrawals[rrsp.id]).toBeCloseTo(30_000, 5);
    expect(rows[0].withdrawals[secondRrsp.id]).toBeCloseTo(50_000, 5);
  });

  it('skips a disabled rule', () => {
    const { scenario, person } = meltdownScenario();
    const rrsp = person.accountBuckets.find((b) => b.kind === 'CA_RRSP_RRIF')!;
    person.meltdownRules = [
      { accountBucketId: rrsp.id, enabled: false, targetTaxableIncomeCeiling: 60_000, startYear: null, endYear: null, destinationAccountBucketId: null },
    ];

    const { rows } = buildFor(scenario, person);
    expect(rows.every((r) => r.meltdownWithdrawalTotal === 0)).toBe(true);
  });
});

describe('combineLedgers', () => {
  function twoPersonScenario() {
    const scenario = createDefaultScenario('US');
    const person1 = scenario.persons[0];
    person1.planningEndAge = new Date().getFullYear() - person1.birthYear + 2;
    setSpending(scenario, { before: [30_000, 20_000] });

    const person2 = createDefaultPersonPlan('US', 'Person 2');
    person2.birthYear = person1.birthYear - 10; // ten years older
    person2.planningEndAge = person1.planningEndAge + 10;
    scenario.persons.push(person2);
    return { scenario, person1, person2 };
  }

  it('sums money columns across persons', () => {
    const { scenario, person1, person2 } = twoPersonScenario();
    const ledgers = buildScenarioLedger(scenario, []);
    const combined = combineLedgers(ledgers, person1.id);

    const p1 = ledgers[0].result.rows[0];
    const p2 = ledgers[1].result.rows[0];
    expect(combined.rows[0].spendingNominal).toBeCloseTo(p1.spendingNominal + p2.spendingNominal, 5);
    expect(combined.rows[0].totalNetWorth).toBeCloseTo(p1.totalNetWorth + p2.totalNetWorth, 5);
    expect(combined.rows[0].taxesPaid.total).toBeCloseTo(p1.taxesPaid.total + p2.taxesPaid.total, 5);
    // Every person's buckets are present in the merged record.
    const allBucketIds = [...person1.accountBuckets, ...person2.accountBuckets].map((b) => b.id);
    expect(Object.keys(combined.rows[0].accountEnd).sort()).toEqual(allBucketIds.sort());
  });

  it('takes the year/age axis from the selected person', () => {
    const { scenario, person1, person2 } = twoPersonScenario();
    const ledgers = buildScenarioLedger(scenario, []);

    const asPerson1 = combineLedgers(ledgers, person1.id);
    const asPerson2 = combineLedgers(ledgers, person2.id);

    expect(asPerson1.rows[0].age).toBe(new Date().getFullYear() - person1.birthYear);
    expect(asPerson2.rows[0].age).toBe(new Date().getFullYear() - person2.birthYear);
    // Same money either way - only the axis changes.
    expect(asPerson2.rows[0].totalNetWorth).toBeCloseTo(asPerson1.rows[0].totalNetWorth, 5);
  });

  it("labels each person's warnings and audit steps with their name", () => {
    const { scenario, person1 } = twoPersonScenario();
    const ledgers = buildScenarioLedger(scenario, []);
    const combined = combineLedgers(ledgers, person1.id);

    expect(combined.rows[0].audit.steps.some((s) => s.label.startsWith('Person 1 · '))).toBe(true);
    expect(combined.rows[0].audit.steps.some((s) => s.label.startsWith('Person 2 · '))).toBe(true);
  });
});

describe('shared (joint) accounts', () => {
  /** A CA scenario with a joint non-registered account both persons can reach. */
  function sharedScenario(sharedBalance = 200_000) {
    const scenario = createDefaultScenario('CA');
    scenario.returnRates = { ...NO_GROWTH };
    const startYear = new Date().getFullYear();

    const person1 = scenario.persons[0];
    person1.planningEndAge = startYear - person1.birthYear + 2;
    person1.benefits = [];

    const person2 = createDefaultPersonPlan('CA', 'Person 2');
    person2.planningEndAge = person1.planningEndAge;
    person2.benefits = [];
    scenario.persons.push(person2);

    const joint: AccountBucket = {
      id: 'joint',
      label: 'Joint Non-Registered',
      country: 'CA',
      kind: 'CA_NON_REGISTERED',
      taxTreatment: 'taxable',
      startingBalance: sharedBalance,
    };
    scenario.sharedAccountBuckets = [joint];
    // The joint account led every person's waterfall before the order became
    // the household's; its kind leads that order now, and joint-before-personal
    // within a kind keeps it draining first.
    scenario.householdWithdrawalOrder = ['CA_NON_REGISTERED', 'CA_CASH_POOL', 'CA_RRSP_RRIF', 'CA_TFSA'];

    return { scenario, person1, person2, joint, startYear };
  }

  it('lets one person fund the household by routing their surplus into a shared account', () => {
    const { scenario, person1, person2, joint, startYear } = sharedScenario(0);
    // Person 1: retired, spends, no income of their own, no accounts to draw
    // on except the joint one. Without shared accounts this is a shortfall.
    person1.retirementStartYear = startYear;
    setSpending(scenario, { atRetirement: [40_000, 0] });
    person1.accountBuckets = [];
    person1.cashBufferRule = { enabled: false, targetMonthsOfSpending: 6, replenishmentOrder: [] };

    // Person 2: the earner, banking everything left over into the joint account.
    person2.annualIncomeNominal = 150_000;
    person2.incomeGrowthRatePct = 0;
    person2.surplusDestinationAccountBucketId = joint.id;

    const ledgers = buildScenarioLedger(scenario, []);
    const p1 = ledgers[0].result;
    const p2 = ledgers[1].result;

    // Person 2's surplus lands in the joint account, and the household's income
    // covers Person 1's spending directly rather than round-tripping through it.
    expect(p2.rows[0].contributions[joint.id]).toBeGreaterThan(0);
    expect(p1.rows[0].withdrawals[joint.id] ?? 0).toBe(0);
    expect(p1.warnings).toHaveLength(0);
  });

  it('serves persons in order from the shared pot, then falls back to their own accounts', () => {
    const { scenario, person1, person2, joint, startYear } = sharedScenario(50_000);
    for (const p of [person1, person2]) {
      p.retirementStartYear = startYear;
      p.cashBufferRule = { enabled: false, targetMonthsOfSpending: 6, replenishmentOrder: [] };
    }
    setSpendingEach(scenario, { atRetirement: 40_000 });

    const ledgers = buildScenarioLedger(scenario, []);
    const p1Row = ledgers[0].result.rows[0];
    const p2Row = ledgers[1].result.rows[0];

    // There is no race any more: one household draw empties the joint account
    // and falls through to personal ones. Joint draws are reported on the
    // primary row, the same place shared growth and contributions land.
    expect(p1Row.withdrawals[joint.id]).toBeCloseTo(50_000, 5);
    expect(p2Row.withdrawals[joint.id] ?? 0).toBe(0);
    const ownDraws = [p1Row, p2Row].some((row) => Object.keys(row.withdrawals).some((id) => id !== joint.id));
    expect(ownDraws).toBe(true);
  });

  it('never lets a shared draw touch either person’s taxable income', () => {
    const { scenario, person1, person2, joint, startYear } = sharedScenario(500_000);
    person1.retirementStartYear = startYear;
    setSpending(scenario, { atRetirement: [60_000, 0] });
    person1.accountBuckets = [];
    person1.cashBufferRule = { enabled: false, targetMonthsOfSpending: 6, replenishmentOrder: [] };
    person2.annualIncomeNominal = 0;

    const p1Row = buildScenarioLedger(scenario, [])[0].result.rows[0];

    // The whole $60k came out of a taxable joint account, so no tax is due -
    // this is the property that keeps per-person tax isolation intact.
    expect(p1Row.withdrawals[joint.id]).toBeCloseTo(60_000, 5);
    expect(buildScenarioLedger(scenario, []).reduce((sum, l) => sum + l.result.rows[0].taxesPaid.total, 0)).toBe(0);
  });

  it('grows a shared account once per year, not once per person', () => {
    const { scenario, joint } = sharedScenario(100_000);
    // The joint account is the only one left standing below, so a scenario-wide
    // 10% is 10% on it and nothing else.
    scenario.returnRates = { investmentsPreRetirementPct: 10, investmentsPostRetirementPct: 10, cashPct: 10 };
    for (const p of scenario.persons) {
      p.accountBuckets = [];
      p.cashBufferRule = { enabled: false, targetMonthsOfSpending: 6, replenishmentOrder: [] };
    }

    const rows = buildScenarioLedger(scenario, [])[0].result.rows;
    // 10% once = 110,000. Applied per-person it would compound to 121,000.
    expect(rows[0].accountEnd[joint.id]).toBeCloseTo(110_000, 5);
  });

  it('counts a shared balance once in combined net worth and sums both persons’ draws', () => {
    const { scenario, person1, person2, joint, startYear } = sharedScenario(100_000);
    for (const p of [person1, person2]) {
      p.retirementStartYear = startYear;
      p.cashBufferRule = { enabled: false, targetMonthsOfSpending: 6, replenishmentOrder: [] };
    }
    setSpendingEach(scenario, { atRetirement: 20_000 });

    const ledgers = buildScenarioLedger(scenario, []);
    const combined = combineLedgers(ledgers, person1.id, scenario.sharedAccountBuckets);
    const p1Row = ledgers[0].result.rows[0];
    const p2Row = ledgers[1].result.rows[0];

    // Neither person's own total claims the joint balance...
    const sharedEnd = p1Row.accountEnd[joint.id];
    expect(sharedEnd).toBeGreaterThan(0);
    const p1OwnedTotal = person1.accountBuckets.reduce((sum, b) => sum + (p1Row.accountEnd[b.id] ?? 0), 0);
    expect(p1Row.totalNetWorth).toBeCloseTo(p1OwnedTotal, 5);
    // ...and the combined total adds it exactly once on top of the two owned totals.
    expect(combined.rows[0].totalNetWorth).toBeCloseTo(p1Row.totalNetWorth + p2Row.totalNetWorth + sharedEnd, 5);

    // Both persons drew from the same bucket - the combined row must add them up.
    expect(combined.rows[0].withdrawals[joint.id]).toBeCloseTo(
      (p1Row.withdrawals[joint.id] ?? 0) + (p2Row.withdrawals[joint.id] ?? 0),
      5,
    );
  });

  it('reports each year’s accountStart as the prior year’s accountEnd, for every bucket', () => {
    // The row's opening position has to be the year's TRUE opening position.
    // It can't be read off the running balances map inside a person's own
    // withdrawal step: by then cash-buffer replenishment has already moved
    // money and any person earlier in the run order has already drawn, so a
    // snapshot taken there reports a mid-year figure - and the grid shows a
    // Start that doesn't tie to the End above it.
    const scenario = createDefaultScenario('CA');
    const startYear = new Date().getFullYear();

    const jointCash: AccountBucket = {
      id: 'joint-cash',
      label: 'Joint Cash',
      country: 'CA',
      kind: 'CA_CASH_POOL',
      taxTreatment: 'taxable',
      startingBalance: 10_000,
      isCashBuffer: true,
    };
    scenario.sharedAccountBuckets = [jointCash];
    scenario.sharedCashBufferRule = { enabled: true, targetAccountBucketId: jointCash.id, targetMonthsOfSpending: 12 };
    scenario.householdWithdrawalOrder = ['CA_CASH_POOL', 'CA_RRSP_RRIF', 'CA_NON_REGISTERED', 'CA_TFSA'];

    const person1 = scenario.persons[0];
    const person2 = createDefaultPersonPlan('CA', 'Person 2');
    scenario.persons.push(person2);

    for (const p of scenario.persons) {
      p.retirementStartYear = startYear;
      p.benefits = [];
      p.planningEndAge = startYear - p.birthYear + 6;
      // Both draw the shared buffer first, then their own accounts - the
      // arrangement that makes ordering effects visible.
      p.cashBufferRule.replenishmentOrder = [p.accountBuckets[0].id];
    }

    const ledgers = buildScenarioLedger(scenario, []);
    const allBuckets = [...person1.accountBuckets, ...person2.accountBuckets, ...scenario.sharedAccountBuckets];

    for (const ledger of ledgers) {
      const visible = [...ledger.plan.accountBuckets, ...scenario.sharedAccountBuckets];
      // Year one opens at each bucket's configured starting balance.
      for (const bucket of visible) {
        expect(ledger.result.rows[0].accountStart[bucket.id]).toBeCloseTo(bucket.startingBalance, 5);
      }
      // ...and every later year opens exactly where the prior one closed.
      for (let i = 1; i < ledger.result.rows.length; i++) {
        for (const bucket of visible) {
          expect(ledger.result.rows[i].accountStart[bucket.id]).toBeCloseTo(ledger.result.rows[i - 1].accountEnd[bucket.id], 5);
        }
      }
      // A row only reports the buckets that person can actually see - leaking
      // someone else's is what let an unconverted balance overwrite the
      // owner's converted one in the combined view.
      const foreign = allBuckets.filter((b) => !visible.some((v) => v.id === b.id));
      for (const bucket of foreign) {
        expect(ledger.result.rows[0].accountStart[bucket.id]).toBeUndefined();
      }
    }
  });
});

describe('household cash buffer', () => {
  /** Two persons, a joint cash account, and a shared buffer rule pointed at it. */
  function bufferScenario() {
    const scenario = createDefaultScenario('CA');
    scenario.returnRates = { ...NO_GROWTH };
    const startYear = new Date().getFullYear();

    const jointCash: AccountBucket = {
      id: 'joint-cash',
      label: 'Joint Cash',
      country: 'CA',
      kind: 'CA_CASH_POOL',
      taxTreatment: 'taxable',
      startingBalance: 0,
      isCashBuffer: true,
    };
    scenario.sharedAccountBuckets = [jointCash];
    scenario.sharedCashBufferRule = { enabled: true, targetAccountBucketId: jointCash.id, targetMonthsOfSpending: 12 };

    const person1 = scenario.persons[0];
    const person2 = createDefaultPersonPlan('CA', 'Person 2');
    scenario.persons.push(person2);

    // Both retired, drawing only from their own non-registered account, so the
    // buffer's sourcing is the only thing under test.
    for (const p of scenario.persons) {
      p.retirementStartYear = startYear;
      p.benefits = [];
      p.planningEndAge = startYear - p.birthYear + 2;
      p.accountBuckets = p.accountBuckets.filter((b) => b.kind === 'CA_NON_REGISTERED');
      p.accountBuckets[0].startingBalance = 500_000;
      p.accountBuckets[0].annualContributionWhileWorking = 0;
      p.cashBufferRule = { enabled: false, targetMonthsOfSpending: 6, replenishmentOrder: [p.accountBuckets[0].id] };
    }
    setSpending(scenario, { atRetirement: [40_000, 20_000] });

    return { scenario, person1, person2, jointCash, startYear };
  }

  it('funds the shared buffer from both people’s accounts, in proportion to what each holds', () => {
    const { scenario, person1, person2 } = bufferScenario();
    const ledgers = buildScenarioLedger(scenario, []);
    const row1 = ledgers[0].result.rows[0];
    const row2 = ledgers[1].result.rows[0];

    // Both hold the same amount of the same kind, so the pooled top-up splits
    // evenly between them - the property that matters is that both contribute
    // rather than one account being emptied before the other is touched.
    const p1Pull = row1.withdrawals[person1.accountBuckets[0].id] ?? 0;
    const p2Pull = row2.withdrawals[person2.accountBuckets[0].id] ?? 0;
    expect(p1Pull).toBeGreaterThan(0);
    expect(p2Pull).toBeGreaterThan(0);
    expect(p1Pull / p2Pull).toBeCloseTo(1, 1);
    // Replenishment now runs BEFORE spending, so the buffer is pre-funded to
    // its full 60k target and joint-cash is also each person's first
    // waterfall entry - that same 60k then correctly funds this year's
    // spending, landing the year-end balance near zero. What proves the
    // buffer actually reached target is the sum of what was pulled in to
    // fund it, not the post-spending ending balance.
    expect(row1.cashBufferReplenishment + row2.cashBufferReplenishment).toBeCloseTo(60_000, 0);
  });

  it('picks up the remainder from the other person when one cannot cover their share', () => {
    const { scenario, person1 } = bufferScenario();
    // Person 1 has almost nothing to contribute; Person 2 must cover the rest.
    person1.accountBuckets[0].startingBalance = 5_000;

    const ledgers = buildScenarioLedger(scenario, []);
    const row1 = ledgers[0].result.rows[0];
    const row2 = ledgers[1].result.rows[0];

    // The buffer still reaches target because the second sweep pulls the
    // shortfall from Person 2 rather than leaving it unfunded - checked via
    // total replenishment rather than the ending balance, since joint-cash
    // is also each person's first waterfall entry and gets drawn back down
    // by that same year's spending immediately after being pre-funded.
    expect(row1.cashBufferReplenishment + row2.cashBufferReplenishment).toBeCloseTo(60_000, 0);
  });

  it('never lets one person’s spending drain the shared buffer before it is replenished, leaving the other with a spurious shortfall', () => {
    // This is the reported bug: replenishment used to run AFTER every
    // person's spending withdrawal in a year, so whoever ran first could
    // drain a shared buffer before the person who runs second even got a
    // turn - even though the household has plenty of money to keep the
    // buffer topped up all along.
    const scenario = createDefaultScenario('CA');
    const startYear = new Date().getFullYear();

    const jointCash: AccountBucket = {
      id: 'joint-cash',
      label: 'Joint Cash',
      country: 'CA',
      kind: 'CA_CASH_POOL',
      taxTreatment: 'taxable',
      startingBalance: 20_000,
      isCashBuffer: true,
    };
    scenario.sharedAccountBuckets = [jointCash];
    // Target = 12 months of the household's combined $30k spending = $30k.
    // Starting balance is only $20k, so $10k of replenishment is needed
    // before anyone draws.
    scenario.sharedCashBufferRule = { enabled: true, targetAccountBucketId: jointCash.id, targetMonthsOfSpending: 12 };

    const person1 = scenario.persons[0];
    const person2 = createDefaultPersonPlan('CA', 'Person 2');
    scenario.persons.push(person2);

    for (const p of scenario.persons) {
      p.retirementStartYear = startYear;
      p.benefits = [];
      p.planningEndAge = startYear - p.birthYear + 1;
      p.cashBufferRule = { enabled: false, targetMonthsOfSpending: 6, replenishmentOrder: [] };
    }

    // Person 1 (processed first) has NOTHING but the joint account to draw
    // from - if it's ever drained by someone else's spending before
    // replenishment tops it back up, they shortfall.
    person1.accountBuckets = [];
    setSpending(scenario, { atRetirement: [20_000, 10_000] });

    // Person 2 has a personal account that funds replenishment but isn't in
    // their OWN spending waterfall - it's household capacity, not a
    // fallback for their own draw.
    person2.accountBuckets = person2.accountBuckets.filter((b) => b.kind === 'CA_NON_REGISTERED');
    person2.accountBuckets[0].startingBalance = 500_000;
    person2.accountBuckets[0].annualContributionWhileWorking = 0;
    person2.cashBufferRule.replenishmentOrder = [person2.accountBuckets[0].id];

    const ledgers = buildScenarioLedger(scenario, []);
    const p1 = ledgers.find((l) => l.plan.id === person1.id)!.result;
    const p2 = ledgers.find((l) => l.plan.id === person2.id)!.result;

    // One household draw covers both people's spending out of the joint
    // account, reported on the primary row - and neither shortfalls.
    const jointDrawn = (p1.rows[0].withdrawals[jointCash.id] ?? 0) + (p2.rows[0].withdrawals[jointCash.id] ?? 0);
    expect(jointDrawn).toBeCloseTo(30_000, 5);
    expect(p1.warnings).toHaveLength(0);
    expect(p2.warnings).toHaveLength(0);
  });

  it('counts every cash account toward the target, so a flush second cash pool blocks the top-up', () => {
    // The target is "does the household hold N months of spending in cash",
    // not "is this one account full" - otherwise the plan sells investments
    // to fill the designated account while cash sits idle in another.
    const { scenario, jointCash } = bufferScenario();
    const otherCash: AccountBucket = {
      id: 'other-cash',
      label: 'Second Cash Pool',
      country: 'CA',
      kind: 'CA_CASH_POOL',
      taxTreatment: 'taxable',
      startingBalance: 500_000,
      isCashBuffer: true,
    };
    scenario.sharedAccountBuckets = [jointCash, otherCash];

    const ledgers = buildScenarioLedger(scenario, []);
    const row1 = ledgers[0].result.rows[0];
    const row2 = ledgers[1].result.rows[0];

    // Household cash (500k) already exceeds the 60k target, so no top-up
    // runs and nothing is credited into the designated buffer account.
    expect(row1.cashBufferReplenishment).toBe(0);
    expect(row2.cashBufferReplenishment).toBe(0);
    expect(row1.contributions[jointCash.id] ?? 0).toBe(0);
    expect(row2.contributions[jointCash.id] ?? 0).toBe(0);

    // The flush pool isn't drained into the designated account to make that one
    // look full. Spending may still draw it - it's cash the household holds -
    // so what's asserted is that no top-up happened, not that it went untouched.
    expect(row1.cashBufferReplenishment).toBe(0);
    expect(row2.cashBufferReplenishment).toBe(0);

    // For contrast, the same scenario WITHOUT the second cash pool does sell
    // investments to raise the full 60k - that difference is the whole point.
    const baseline = bufferScenario();
    const baselineLedgers = buildScenarioLedger(baseline.scenario, []);
    const baselineRaised = baselineLedgers.reduce((sum, l) => sum + l.result.rows[0].cashBufferReplenishment, 0);
    expect(baselineRaised).toBeCloseTo(60_000, 0);
    expect(baselineLedgers[0].result.rows[0].withdrawals[baseline.person1.accountBuckets[0].id] ?? 0).toBeGreaterThan(0);
    expect(baselineLedgers[1].result.rows[0].withdrawals[baseline.person2.accountBuckets[0].id] ?? 0).toBeGreaterThan(0);
  });

  it('still tops up from investments when household cash genuinely falls short', () => {
    // Same shape as above, but the second cash pool only partly covers the
    // target - the top-up should make up exactly the difference, no more.
    const { scenario, jointCash } = bufferScenario();
    const otherCash: AccountBucket = {
      id: 'other-cash',
      label: 'Second Cash Pool',
      country: 'CA',
      kind: 'CA_CASH_POOL',
      taxTreatment: 'taxable',
      startingBalance: 20_000,
      isCashBuffer: true,
    };
    scenario.sharedAccountBuckets = [jointCash, otherCash];

    const ledgers = buildScenarioLedger(scenario, []);
    const totalReplenished = ledgers.reduce((sum, l) => sum + l.result.rows[0].cashBufferReplenishment, 0);

    // Target 60k, 20k already held in cash => only the missing 40k is raised.
    expect(totalReplenished).toBeCloseTo(40_000, 0);
    // The cash already on hand was left where it was, not shuffled between
    // accounts to make the designated one look full.
    expect(ledgers[0].result.rows[0].contributions[otherCash.id] ?? 0).toBe(0);
  });

  it('fills the shared buffer even when a person has no cash bucket of their own', () => {
    const { scenario, person1 } = bufferScenario();
    expect(person1.accountBuckets.find((b) => b.isCashBuffer)).toBeUndefined();

    const rows = buildScenarioLedger(scenario, [])[0].result.rows;
    expect(rows[0].cashBufferReplenishment).toBeGreaterThan(0);
  });

  it('taxes a replenishment sourced from a tax-deferred account', () => {
    const { scenario, person1, person2 } = bufferScenario();
    // The RRSP has to be the household's ONLY source. The top-up is pooled
    // across everyone's accounts in kind order now, so a funded non-registered
    // account belonging to anyone would - correctly - be sold ahead of it, and
    // no taxable distribution would happen at all.
    person2.accountBuckets[0].startingBalance = 0;
    const rrsp: AccountBucket = {
      id: 'p1-rrsp',
      label: 'RRSP',
      country: 'CA',
      kind: 'CA_RRSP_RRIF',
      taxTreatment: 'taxDeferred',
      startingBalance: 500_000,
    };
    person1.accountBuckets = [rrsp];
    person1.cashBufferRule = { enabled: false, targetMonthsOfSpending: 6, replenishmentOrder: [rrsp.id] };
    setSpending(scenario, { atRetirement: [scenario.householdSpendingRealAtRetirement, 0] }); // isolate Person 1's contribution

    const row1 = buildScenarioLedger(scenario, [])[0].result.rows[0];

    // Pulling from the RRSP is a real distribution, so tax is charged...
    expect(row1.taxesPaid.total).toBeGreaterThan(0);
    // ...and the audit trail names it.
    expect(row1.audit.steps.some((s) => s.label.includes('cash-buffer replenishment'))).toBe(true);
  });

  it('stacks a spending-driven tax-deferred withdrawal on top of a same-year replenishment, as one combined bracket walk', () => {
    // Replenishment now runs before a person's own spending/tax step, so a
    // taxable distribution it generates has to raise the marginal rate that
    // person's own tax-deferred spending withdrawal is taxed at - not be
    // taxed as if it were a second, independent $0-to-X bracket walk (which
    // would under-charge tax by reusing the lowest brackets twice).
    const scenario = createDefaultScenario('CA');
    const startYear = new Date().getFullYear();
    const person = scenario.persons[0];
    person.retirementStartYear = startYear;
    person.planningEndAge = startYear - person.birthYear + 1;
    person.benefits = [];
    person.annualIncomeNominal = 0;
    setSpending(scenario, { atRetirement: [50_000] });

    const cash: AccountBucket = {
      id: 'own-cash',
      label: 'Cash',
      country: 'CA',
      kind: 'CA_CASH_POOL',
      taxTreatment: 'taxable',
      startingBalance: 0,
      isCashBuffer: true,
    };
    // Sized to exactly cover the replenishment's own gross-up plus the
    // spending-driven $25k direct pull, and not a cent more - so the
    // separate withdrawal that pays the tax bill itself is forced onto
    // `backstop` instead of adding a THIRD, untracked pull onto this same
    // bucket and confounding the totalRrspPulled measurement below.
    const replenishmentGross = grossUpForNet(25_000, 0, scenario.taxConfig, Number.MAX_SAFE_INTEGER);
    const rrsp: AccountBucket = {
      id: 'rrsp',
      label: 'RRSP',
      country: 'CA',
      kind: 'CA_RRSP_RRIF',
      taxTreatment: 'taxDeferred',
      startingBalance: replenishmentGross + 25_000,
    };
    const backstop: AccountBucket = {
      id: 'backstop',
      label: 'Backstop Non-Registered',
      country: 'CA',
      kind: 'CA_NON_REGISTERED',
      taxTreatment: 'taxable',
      startingBalance: 1_000_000,
    };
    person.accountBuckets = [cash, rrsp, backstop];
    // The million-dollar backstop would otherwise throw off distributions that
    // are also taxable income, and this test asserts the RRSP pulls are the
    // whole of it.
    withoutTaxableAccountTax(scenario);
    // The RRSP leads, so the spending draw lands on it rather than on cash -
    // that direct pull is the thing this test measures.
    scenario.householdWithdrawalOrder = ['CA_RRSP_RRIF', 'CA_NON_REGISTERED', 'CA_CASH_POOL'];
    // Target ($25k, 6 months) covers only half of the $50k spending need -
    // the rest must come directly from the RRSP, a second tax-deferred pull
    // in the same year as the replenishment's own RRSP pull.
    person.cashBufferRule = { enabled: true, targetMonthsOfSpending: 6, replenishmentOrder: [rrsp.id] };

    const row = buildScenarioLedger(scenario, [])[0].result.rows[0];

    // The RRSP is drained to exactly zero by replenishment + spending, so
    // this is precisely those two pulls combined - with no other income or
    // benefit, the person's ENTIRE taxable distribution for the year. The
    // tax bill itself was paid out of `backstop`, not RRSP, so it can't leak
    // into this figure.
    const totalRrspPulled = row.withdrawals[rrsp.id];
    expect(totalRrspPulled).toBeCloseTo(replenishmentGross + 25_000, 2);
    expect(row.cashBufferReplenishment).toBeCloseTo(25_000, 0);

    const expectedTax = calculateTotalTax(totalRrspPulled, scenario.taxConfig).total;
    expect(row.taxesPaid.total).toBeCloseTo(expectedTax, 2);
  });
});

describe('household-wide cash buffer replenishment', () => {
  /**
   * Two retired people and a shared buffer, where one holds the household's
   * taxable money and the other holds only tax-free money. This is the shape
   * that used to raid the tax-free account: the top-up was split evenly and
   * each half was funded from its own person's list, so the person with only a
   * TFSA sold TFSA - while the household plainly had taxable assets to sell.
   */
  function splitHousehold(options: { taxableBalance?: number; taxFreeBalance?: number } = {}) {
    const scenario = createDefaultScenario('CA');
    scenario.returnRates = { ...NO_GROWTH };
    const startYear = new Date().getFullYear();

    const jointCash: AccountBucket = {
      id: 'joint-cash',
      label: 'Joint Cash',
      country: 'CA',
      kind: 'CA_CASH_POOL',
      taxTreatment: 'taxable',
      startingBalance: 0,
      isCashBuffer: true,
    };
    scenario.sharedAccountBuckets = [jointCash];
    scenario.sharedCashBufferRule = { enabled: true, targetAccountBucketId: jointCash.id, targetMonthsOfSpending: 12 };

    const person1 = scenario.persons[0];
    const person2 = createDefaultPersonPlan('CA', 'Person 2');
    scenario.persons.push(person2);

    const taxable: AccountBucket = {
      id: 'p1-nonreg',
      label: 'Non-Registered',
      country: 'CA',
      kind: 'CA_NON_REGISTERED',
      taxTreatment: 'taxable',
      startingBalance: options.taxableBalance ?? 500_000,
    };
    const taxFree: AccountBucket = {
      id: 'p2-tfsa',
      label: 'TFSA',
      country: 'CA',
      kind: 'CA_TFSA',
      taxTreatment: 'taxFree',
      startingBalance: options.taxFreeBalance ?? 500_000,
    };

    for (const p of scenario.persons) {
      p.retirementStartYear = startYear;
      p.benefits = [];
      p.planningEndAge = startYear - p.birthYear;
      p.meltdownRules = [];
    }
    person1.accountBuckets = [taxable];
    person1.cashBufferRule = { enabled: false, targetMonthsOfSpending: 6, replenishmentOrder: [taxable.id] };
    person2.accountBuckets = [taxFree];
    person2.cashBufferRule = { enabled: false, targetMonthsOfSpending: 6, replenishmentOrder: [taxFree.id] };
    setSpending(scenario, { atRetirement: [60_000, 0] });

    const drawn = () => {
      const ledgers = buildScenarioLedger(scenario, []);
      return {
        taxable: ledgers[0].result.rows[0].withdrawals[taxable.id] ?? 0,
        taxFree: ledgers[1].result.rows[0].withdrawals[taxFree.id] ?? 0,
        replenished: ledgers[0].result.rows[0].cashBufferReplenishment + ledgers[1].result.rows[0].cashBufferReplenishment,
        warnings: ledgers.flatMap((l) => l.result.warnings),
      };
    };

    return { scenario, person1, person2, taxable, taxFree, jointCash, drawn };
  }

  it('funds the top-up from the household’s taxable account rather than the other person’s tax-free one', () => {
    const { scenario, drawn } = splitHousehold();
    // Non-registered leads the household order, TFSA is last.
    scenario.householdWithdrawalOrder = ['CA_CASH_POOL', 'CA_NON_REGISTERED', 'CA_TFSA'];

    const result = drawn();
    // 12 months of the household's 60k, plus that same year's spending, all
    // from the one account the order says to spend first.
    expect(result.replenished).toBeCloseTo(60_000, 0);
    expect(result.taxFree).toBe(0);
    expect(result.taxable).toBeGreaterThan(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('follows the household kind order, not each person’s own replenishment list', () => {
    // Same two accounts, same two lists - only the household order is flipped,
    // and the top-up flips with it. That is the whole claim: the kind order
    // decides where the money comes from now.
    const { scenario, drawn } = splitHousehold();
    scenario.householdWithdrawalOrder = ['CA_CASH_POOL', 'CA_TFSA', 'CA_NON_REGISTERED'];

    const result = drawn();
    expect(result.taxFree).toBeGreaterThan(0);
    expect(result.taxable).toBe(0);
  });

  it('splits a kind proportionally between two people rather than emptying one account first', () => {
    const { scenario, person2, taxFree } = splitHousehold({ taxableBalance: 100_000 });
    scenario.householdWithdrawalOrder = ['CA_CASH_POOL', 'CA_NON_REGISTERED', 'CA_TFSA'];
    // Person 2 now holds non-registered money too, 9x Person 1's.
    const second: AccountBucket = { ...taxFree, id: 'p2-nonreg', label: 'Non-Registered 2', kind: 'CA_NON_REGISTERED', taxTreatment: 'taxable', startingBalance: 900_000 };
    person2.accountBuckets = [second];
    person2.cashBufferRule.replenishmentOrder = [second.id];

    const ledgers = buildScenarioLedger(scenario, []);
    const p1 = ledgers[0].result.rows[0].cashBufferReplenishment;
    const p2 = ledgers[1].result.rows[0].cashBufferReplenishment;

    expect(p1 + p2).toBeCloseTo(60_000, 0);
    expect(p1 / p2).toBeCloseTo(1 / 9, 4);
  });

  it('still honours an account its owner left out of their replenishment order', () => {
    // The per-person list no longer decides the ORDER, but it is still how an
    // account is kept off limits to the top-up entirely.
    const { scenario, person1, taxFree, drawn } = splitHousehold();
    scenario.householdWithdrawalOrder = ['CA_CASH_POOL', 'CA_NON_REGISTERED', 'CA_TFSA'];
    person1.cashBufferRule.replenishmentOrder = [];

    const result = drawn();
    // Person 1's taxable account is excluded, so the top-up falls through to
    // the only remaining source - and lands there rather than shortfalling.
    expect(result.taxable).toBe(0);
    expect(result.taxFree).toBeGreaterThan(0);
    expect(result.taxFree).toBeLessThanOrEqual(taxFree.startingBalance);
  });

  it('can still top up from a kind the household order leaves out of SPENDING', () => {
    // Omitting a kind means "don't spend this down", not "this money doesn't
    // exist" - the top-up keeps its own rules, which is the distinction that
    // choice rests on. Here nothing but the excluded TFSA can fund it.
    const { scenario, person1, drawn } = splitHousehold();
    scenario.householdWithdrawalOrder = ['CA_CASH_POOL', 'CA_NON_REGISTERED'];
    person1.accountBuckets[0].startingBalance = 0;

    const result = drawn();
    expect(result.taxFree).toBeGreaterThan(0);
  });

  it('taxes a pooled top-up to whoever owns the account it came out of', () => {
    const { scenario, person1, taxable, drawn } = splitHousehold();
    scenario.householdWithdrawalOrder = ['CA_CASH_POOL', 'CA_RRSP_RRIF', 'CA_TFSA'];
    // Person 1's money is now tax-deferred, and it funds a top-up that exists
    // because of the HOUSEHOLD's spending - but the CRA still assesses them.
    person1.accountBuckets = [{ ...taxable, kind: 'CA_RRSP_RRIF', taxTreatment: 'taxDeferred' }];

    const ledgers = buildScenarioLedger(scenario, []);
    const row1 = ledgers[0].result.rows[0];
    const row2 = ledgers[1].result.rows[0];

    expect(row1.withdrawals[taxable.id] ?? 0).toBeGreaterThan(0);
    expect(row1.taxesPaid.total).toBeGreaterThan(0);
    // Person 2 drew nothing and earns nothing, so none of it lands on them.
    expect(row2.taxesPaid.total).toBe(0);
    // Grossed up, so the buffer still reaches target despite the tax.
    expect(drawn().replenished).toBeCloseTo(60_000, 0);
  });
});

describe('cross-border accounts (US account reported in a CAD scenario)', () => {
  /**
   * Balances are entered in the account's own currency but every figure they
   * are compared against - spending, tax brackets, meltdown ceilings - is in
   * the scenario's. These pin the conversion happening on the way IN, so
   * those comparisons are never mixing units.
   */
  function crossBorderScenario(ceiling: number) {
    const scenario = createDefaultScenario('CA');
    scenario.returnRates = { ...NO_GROWTH };
    const startYear = new Date().getFullYear();
    const person = scenario.persons[0];

    const cash: AccountBucket = {
      id: 'cash', label: 'Cash', country: 'CA', kind: 'CA_CASH_POOL', taxTreatment: 'taxable',
      startingBalance: 100_000, isCashBuffer: true, };
    const ira: AccountBucket = {
      id: 'ira', label: 'Traditional 401(k)/IRA', country: 'US', kind: 'US_TRADITIONAL_401K_IRA', taxTreatment: 'taxDeferred',
      startingBalance: 2_000_000, };
    const nonReg: AccountBucket = {
      id: 'nonreg', label: 'Non-Registered', country: 'CA', kind: 'CA_NON_REGISTERED', taxTreatment: 'taxable',
      startingBalance: 0, };

    person.birthYear = startYear - 74;
    person.planningEndAge = 76;
    person.retirementStartYear = startYear;
    person.benefits = [];
    person.annualIncomeNominal = 0;
    setSpending(scenario, { atRetirement: [80_000] });
    person.accountBuckets = [cash, ira, nonReg];
    person.cashBufferRule = { enabled: false, targetMonthsOfSpending: 6, replenishmentOrder: [] };
    person.requiredDistributionRule = { enabled: true, startAgeOverride: null, destinationAccountBucketId: nonReg.id };
    person.meltdownRules = [
      { accountBucketId: ira.id, enabled: true, targetTaxableIncomeCeiling: ceiling, startYear, endYear: startYear + 10, destinationAccountBucketId: nonReg.id },
    ];
    return { scenario, person, ira, startYear };
  }

  it('converts a USD balance into the scenario currency once, on the way in', () => {
    const { scenario, ira } = crossBorderScenario(258_000);
    expect(scenario.exchangeRateUsdToCad).toBe(1.35);
    const row = buildScenarioLedger(scenario, [])[0].result.rows[0];
    // Entered as 2,000,000 USD; modelled and reported as CAD throughout.
    expect(row.accountStart[ira.id]).toBeCloseTo(2_000_000 * 1.35, 2);
  });

  it('applies a meltdown ceiling in the scenario currency, not the account’s', () => {
    // Previously a 258,000 CAD ceiling drew 258,000 USD - 348,300 CAD, 35% over.
    const { scenario, ira } = crossBorderScenario(258_000);
    const row = buildScenarioLedger(scenario, [])[0].result.rows[0];
    expect(row.withdrawals[ira.id] ?? 0).toBeCloseTo(258_000, 2);
  });

  it('taxes the scenario-currency income, not the raw foreign figure', () => {
    // Previously the USD number was fed to the CAD bracket table, undercharging.
    const { scenario } = crossBorderScenario(258_000);
    const row = buildScenarioLedger(scenario, [])[0].result.rows[0];
    expect(row.taxesPaid.total).toBeCloseTo(calculateTotalTax(258_000, scenario.taxConfig).total, 2);
  });

  it('sizes a required distribution off the converted prior year-end balance', () => {
    const { scenario, ira } = crossBorderScenario(0);
    const rows = buildScenarioLedger(scenario, [])[0].result.rows;
    const at75 = rows.find((r) => r.age === 75)!;
    const priorEnd = rows.find((r) => r.age === 74)!.accountEnd[ira.id];
    // US account, so the IRS divisor for 75 applies - to the CAD balance.
    expect(at75.requiredDistributionTotal).toBeCloseTo(priorEnd / 24.6, 2);
  });
});

describe('required minimum distributions', () => {
  /** A person past their RRIF start age with an empty cash buffer and a large RRSP. */
  function rmdScenario(options: { age?: number; spending?: number; cashStart?: number; enabled?: boolean } = {}) {
    const scenario = createDefaultScenario('CA');
    scenario.returnRates = { ...NO_GROWTH };
    const startYear = new Date().getFullYear();
    const person = scenario.persons[0];
    const age = options.age ?? 80;

    const cash: AccountBucket = {
      id: 'cash', label: 'Cash', country: 'CA', kind: 'CA_CASH_POOL', taxTreatment: 'taxable',
      startingBalance: options.cashStart ?? 0, isCashBuffer: true, };
    const rrsp: AccountBucket = {
      id: 'rrsp', label: 'RRSP', country: 'CA', kind: 'CA_RRSP_RRIF', taxTreatment: 'taxDeferred',
      startingBalance: 600_000, };
    const tfsa: AccountBucket = {
      id: 'tfsa', label: 'TFSA', country: 'CA', kind: 'CA_TFSA', taxTreatment: 'taxFree',
      startingBalance: 0, };

    person.birthYear = startYear - age;
    person.planningEndAge = age + 1;
    person.retirementStartYear = startYear;
    person.benefits = [];
    person.annualIncomeNominal = 0;
    setSpending(scenario, { atRetirement: [options.spending ?? 20_000] });
    person.accountBuckets = [cash, rrsp, tfsa];
    person.cashBufferRule = { enabled: true, targetMonthsOfSpending: 12, replenishmentOrder: [rrsp.id] };
    person.meltdownRules = [];
    person.requiredDistributionRule = {
      enabled: options.enabled ?? true,
      startAgeOverride: null,
      destinationAccountBucketId: tfsa.id,
    };
    return { scenario, person, cash, rrsp, tfsa, startYear, age };
  }

  it('forces a withdrawal once past the start age, sized off the prior year-end balance', () => {
    const { scenario, rrsp, age } = rmdScenario();
    const row = buildScenarioLedger(scenario, [])[0].result.rows[0];

    // Age 80 in Canada = 6.82% of the 600k opening balance.
    expect(row.requiredDistributionTotal).toBeCloseTo(600_000 * 0.0682, 2);
    expect(row.withdrawals[rrsp.id] ?? 0).toBeGreaterThanOrEqual(600_000 * 0.0682 - 0.01);
    expect(age).toBe(80);
  });

  it('takes nothing while the person is still below the start age', () => {
    const { scenario } = rmdScenario({ age: 65 });
    const row = buildScenarioLedger(scenario, [])[0].result.rows[0];
    expect(row.requiredDistributionTotal).toBe(0);
  });

  it('can be switched off for modelling', () => {
    const { scenario } = rmdScenario({ enabled: false });
    const row = buildScenarioLedger(scenario, [])[0].result.rows[0];
    expect(row.requiredDistributionTotal).toBe(0);
  });

  it('routes the proceeds to the cash buffer first and reinvests the excess', () => {
    // 6.82% of 600k = 40,920 gross. A 12-month buffer on 20k of spending
    // needs 20k, so the buffer takes its fill and the rest lands in the TFSA.
    const { scenario, cash, tfsa } = rmdScenario({ spending: 20_000 });
    const row = buildScenarioLedger(scenario, [])[0].result.rows[0];

    expect(row.contributions[cash.id] ?? 0).toBeCloseTo(20_000, 2);
    expect(row.contributions[tfsa.id] ?? 0).toBeGreaterThan(0);
    // Nothing evaporates: gross out equals tax plus everything deposited.
    const deposited = (row.contributions[cash.id] ?? 0) + (row.contributions[tfsa.id] ?? 0);
    expect(deposited + row.taxesPaid.total).toBeCloseTo(row.requiredDistributionTotal, 2);
  });

  it('sends everything to the buffer when the distribution cannot even fill it', () => {
    // A 12-month buffer on 200k of spending needs far more than the ~41k
    // distribution, so none of it should reach the reinvestment account.
    const { scenario, cash, tfsa } = rmdScenario({ spending: 200_000 });
    const row = buildScenarioLedger(scenario, [])[0].result.rows[0];

    expect(row.contributions[cash.id] ?? 0).toBeGreaterThan(0);
    expect(row.contributions[tfsa.id] ?? 0).toBe(0);
  });

  it('leaves the buffer top-up nothing to raise when the distribution already covered it', () => {
    // Without the distribution the buffer would have to sell something to
    // reach target; the forced money covers it instead.
    const withRmd = rmdScenario({ spending: 20_000, enabled: true });
    const withoutRmd = rmdScenario({ spending: 20_000, enabled: false });

    const a = buildScenarioLedger(withRmd.scenario, [])[0].result.rows[0];
    const b = buildScenarioLedger(withoutRmd.scenario, [])[0].result.rows[0];

    expect(a.cashBufferReplenishment).toBeCloseTo(20_000, 2);
    expect(b.cashBufferReplenishment).toBeCloseTo(20_000, 2);
    // Both fill the buffer, but only the RMD case ends up with money parked
    // in the tax-free account, because the forced withdrawal exceeded the need.
    expect(a.accountEnd[withRmd.tfsa.id]).toBeGreaterThan(0);
    expect(b.accountEnd[withoutRmd.tfsa.id]).toBe(0);
  });

  it('taxes the distribution as ordinary income, once', () => {
    const { scenario } = rmdScenario();
    const row = buildScenarioLedger(scenario, [])[0].result.rows[0];

    expect(row.taxesPaid.total).toBeGreaterThan(0);
    // The whole year's taxable income here is the distribution plus whatever
    // the spending draw pulled from the RRSP - taxing it twice would show up
    // as tax exceeding a full-bracket walk over the total withdrawn.
    const totalRrspOut = row.withdrawals[scenario.persons[0].accountBuckets[1].id] ?? 0;
    expect(row.taxesPaid.total).toBeLessThanOrEqual(calculateTotalTax(totalRrspOut, scenario.taxConfig).total + 0.01);
  });

  it('shrinks a meltdown in the same year rather than stacking on top of it', () => {
    // The forced distribution already fills part of the bracket, so a
    // meltdown aiming at a ceiling should only top up the remainder.
    const { scenario, rrsp } = rmdScenario({ spending: 20_000 });
    const person = scenario.persons[0];
    person.meltdownRules = [
      {
        accountBucketId: rrsp.id,
        enabled: true,
        targetTaxableIncomeCeiling: 60_000,
        startYear: null,
        endYear: null,
        destinationAccountBucketId: person.accountBuckets[2].id,
      },
    ];

    const row = buildScenarioLedger(scenario, [])[0].result.rows[0];
    const forced = row.requiredDistributionTotal;
    expect(forced).toBeGreaterThan(0);
    // Total taxable income out of the RRSP should stop at the ceiling, not
    // reach it separately on top of the forced amount.
    expect(row.withdrawals[rrsp.id] ?? 0).toBeLessThanOrEqual(60_000 + 0.01);
  });
});

describe('meltdown and cash buffer in the same year', () => {
  /**
   * A retired person with an empty cash buffer, a taxable brokerage, and an
   * RRSP being melted down - the arrangement where funding the buffer from
   * the wrong account quietly liquidates investments.
   */
  function meltdownScenario(options: { ceiling?: number; destination?: 'tfsa' | 'unset' } = {}) {
    const scenario = createDefaultScenario('CA');
    scenario.returnRates = { ...NO_GROWTH };
    const startYear = new Date().getFullYear();
    const person = scenario.persons[0];

    const cash: AccountBucket = {
      id: 'cash', label: 'Cash', country: 'CA', kind: 'CA_CASH_POOL', taxTreatment: 'taxable',
      startingBalance: 0, isCashBuffer: true, };
    const brokerage: AccountBucket = {
      id: 'brokerage', label: 'Non-Registered', country: 'CA', kind: 'CA_NON_REGISTERED', taxTreatment: 'taxable',
      startingBalance: 400_000, };
    const rrsp: AccountBucket = {
      id: 'rrsp', label: 'RRSP', country: 'CA', kind: 'CA_RRSP_RRIF', taxTreatment: 'taxDeferred',
      startingBalance: 600_000, };
    const tfsa: AccountBucket = {
      id: 'tfsa', label: 'TFSA', country: 'CA', kind: 'CA_TFSA', taxTreatment: 'taxFree',
      startingBalance: 0, };

    person.accountBuckets = [cash, brokerage, rrsp, tfsa];
    person.retirementStartYear = startYear;
    person.planningEndAge = startYear - person.birthYear + 1;
    person.benefits = [];
    person.annualIncomeNominal = 0;
    setSpending(scenario, { atRetirement: [40_000] });
    person.surplusDestinationAccountBucketId = null;
    // Brokerage listed FIRST - without the meltdown-aware reordering this is
    // what the top-up would sell.
    person.cashBufferRule = { enabled: true, targetMonthsOfSpending: 12, replenishmentOrder: [brokerage.id, rrsp.id] };
    person.meltdownRules = [
      {
        accountBucketId: rrsp.id,
        enabled: true,
        targetTaxableIncomeCeiling: options.ceiling ?? 90_000,
        startYear,
        endYear: startYear + 5,
        destinationAccountBucketId: options.destination === 'unset' ? null : tfsa.id,
      },
    ];
    return { scenario, person, cash, brokerage, rrsp, tfsa };
  }

  it('funds the cash buffer from the meltdown account instead of selling investments', () => {
    const { scenario, brokerage, rrsp } = meltdownScenario();
    const row = buildScenarioLedger(scenario, [])[0].result.rows[0];

    // The buffer is filled, and the money came out of the RRSP that was
    // being melted down anyway - not out of the brokerage.
    expect(row.cashBufferReplenishment).toBeGreaterThan(0);
    expect(row.withdrawals[rrsp.id] ?? 0).toBeGreaterThan(0);
    // Sub-cent rather than exactly zero: the gross-up solves by fixed point,
    // so it can leave a fraction of a cent of the need for the next source.
    expect(row.withdrawals[brokerage.id] ?? 0).toBeLessThan(0.01);
    expect(row.accountEnd[brokerage.id]).toBeCloseTo(400_000, 2);
  });

  it('does not let the top-up push taxable income past the meltdown ceiling', () => {
    // A 12-month buffer on 40k of spending needs 40k net. A ceiling only
    // barely above the spending withdrawal leaves little headroom, so most
    // of the top-up must fall through to the brokerage instead.
    const { scenario, brokerage, rrsp } = meltdownScenario({ ceiling: 15_000 });
    const row = buildScenarioLedger(scenario, [])[0].result.rows[0];

    const rrspPulled = row.withdrawals[rrsp.id] ?? 0;
    expect(rrspPulled).toBeLessThanOrEqual(15_000 + 0.01);
    // The rest of the cash need still gets met, from the next source down.
    expect(row.withdrawals[brokerage.id] ?? 0).toBeGreaterThan(0);
  });

  it('never leaves a meltdown’s proceeds unaccounted for when no destination is set', () => {
    // An unset destination used to withdraw and tax the money, then credit
    // it nowhere - the household simply got poorer by the meltdown amount.
    const withDestination = meltdownScenario({ destination: 'tfsa' });
    const withoutDestination = meltdownScenario({ destination: 'unset' });

    const a = buildScenarioLedger(withDestination.scenario, [])[0].result.rows[0];
    const b = buildScenarioLedger(withoutDestination.scenario, [])[0].result.rows[0];

    // Whatever leaves the RRSP has to show up somewhere, either way.
    expect(b.withdrawals[withoutDestination.rrsp.id] ?? 0).toBeGreaterThan(0);
    expect(b.totalNetWorth).toBeCloseTo(a.totalNetWorth, 2);

    // And the proceeds are credited to a real account, not dropped.
    const creditedSomewhere = Object.values(b.contributions).reduce((sum, v) => sum + v, 0);
    expect(creditedSomewhere).toBeGreaterThan(0);
  });
});

describe('funded contributions', () => {
  const startYear = new Date().getFullYear();

  /** One earner, one person with no income at all, and a joint cash account between them. */
  function householdScenario() {
    const scenario = createDefaultScenario('CA');
    scenario.returnRates = { ...NO_GROWTH };

    const jointCash: AccountBucket = {
      id: 'joint-cash',
      label: 'Joint Cash',
      country: 'CA',
      kind: 'CA_CASH_POOL',
      taxTreatment: 'taxable',
      startingBalance: 400_000,
      isCashBuffer: true,
    };
    scenario.sharedAccountBuckets = [jointCash];
    scenario.sharedCashBufferRule = { enabled: false, targetAccountBucketId: jointCash.id, targetMonthsOfSpending: 12 };

    const earner = scenario.persons[0];
    const dependent = createDefaultPersonPlan('CA', 'Person 2');
    scenario.persons.push(dependent);

    for (const p of scenario.persons) {
      p.benefits = [];
      p.planningEndAge = startYear - p.birthYear + 2;
      p.cashBufferRule = { enabled: false, targetMonthsOfSpending: 6, replenishmentOrder: [] };
    }
    earner.annualIncomeNominal = 150_000;
    // Person 2 has NOTHING of their own: no income, and no cash account. The
    // joint account is the household's only way to pay for their contributions.
    dependent.annualIncomeNominal = 0;
    dependent.accountBuckets = dependent.accountBuckets.filter((b) => !b.isCashBuffer);

    return { scenario, earner, dependent, jointCash };
  }

  it('pays for a no-income person’s contributions out of the shared cash', () => {
    // The reported bug: their accounts grew every year by the full configured
    // contribution while the joint account they'd have to come from sat
    // untouched - the household simply minted the money.
    const { scenario, dependent, jointCash } = householdScenario();
    const rrsp = dependent.accountBuckets.find((b) => b.kind === 'CA_RRSP_RRIF')!;
    const row = buildFor(scenario, dependent).rows[0];

    const contributed = dependent.accountBuckets.reduce((sum, b) => sum + (row.contributions[b.id] ?? 0), 0);
    expect(row.contributions[rrsp.id]).toBeCloseTo(32_490, 2);
    expect(contributed).toBeCloseTo(32_490 + 10_000 + 7_000, 2);

    // Every dollar of it left the joint account, on this person's own row.
    expect(row.withdrawals[jointCash.id]).toBeCloseTo(contributed, 2);
  });

  it('stops contributing once the household has nothing left to fund it with, and says so', () => {
    const { scenario, earner, dependent, jointCash } = householdScenario();
    // Only enough joint cash for a fraction of one year's contributions.
    jointCash.startingBalance = 12_000;
    earner.annualIncomeNominal = 0;
    for (const b of earner.accountBuckets) b.annualContributionWhileWorking = 0;
    // Cash is not the only thing that can pay for a contribution any more -
    // taxable investments back it up, which is the whole point of funding a
    // TFSA top-up by selling non-registered. So for the household to run out,
    // it has to actually run out: no taxable balances, and none arriving by
    // way of a contribution that a later year could recycle.
    for (const p of scenario.persons) {
      for (const b of p.accountBuckets) {
        if (b.taxTreatment !== 'taxable') continue;
        b.startingBalance = 0;
        b.annualContributionWhileWorking = 0;
      }
    }

    const { rows, warnings } = buildFor(scenario, dependent);

    const firstYear = dependent.accountBuckets.reduce((sum, b) => sum + (rows[0].contributions[b.id] ?? 0), 0);
    const secondYear = dependent.accountBuckets.reduce((sum, b) => sum + (rows[1].contributions[b.id] ?? 0), 0);
    expect(firstYear).toBeCloseTo(12_000, 2);
    expect(secondYear).toBe(0);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].message).toMatch(/Contributions short by/);
  });

  it('sells a taxable investment to fund a contribution when cash is short', () => {
    // The reported oddity: SHRINKING the cash buffer produced "contributions
    // short" warnings while the household held millions in investments. Cash
    // was the only thing allowed to fund a contribution, so the warning was
    // really measuring the buffer's size rather than the household's means.
    const { scenario, earner, dependent, jointCash } = householdScenario();
    jointCash.startingBalance = 0;
    earner.annualIncomeNominal = 0;
    for (const b of earner.accountBuckets) b.annualContributionWhileWorking = 0;

    const nonRegistered = dependent.accountBuckets.find((b) => b.kind === 'CA_NON_REGISTERED')!;
    const tfsa = dependent.accountBuckets.find((b) => b.kind === 'CA_TFSA')!;
    nonRegistered.startingBalance = 500_000;
    nonRegistered.annualContributionWhileWorking = 0;
    for (const b of dependent.accountBuckets) {
      if (b.id !== tfsa.id) b.annualContributionWhileWorking = 0;
    }
    tfsa.annualContributionWhileWorking = 7_000;

    const { rows, warnings } = buildFor(scenario, dependent);

    // Funded in full out of the non-registered account, with no cash anywhere.
    expect(rows[0].contributions[tfsa.id]).toBeCloseTo(7_000, 2);
    expect(rows[0].withdrawals[nonRegistered.id]).toBeCloseTo(7_000, 2);
    expect(warnings).toHaveLength(0);
  });

  it('will not fund a contribution out of a registered account', () => {
    // A tax-deferred sale would create income after tax has been computed, so
    // it would go uncharged; a tax-free one would move money between two
    // tax-free accounts and accomplish nothing. Neither is a funding source.
    const { scenario, earner, dependent, jointCash } = householdScenario();
    jointCash.startingBalance = 0;
    earner.annualIncomeNominal = 0;
    for (const b of earner.accountBuckets) b.annualContributionWhileWorking = 0;

    const rrsp = dependent.accountBuckets.find((b) => b.kind === 'CA_RRSP_RRIF')!;
    const tfsa = dependent.accountBuckets.find((b) => b.kind === 'CA_TFSA')!;
    for (const b of dependent.accountBuckets) {
      b.annualContributionWhileWorking = b.id === tfsa.id ? 7_000 : 0;
      if (b.taxTreatment === 'taxable') b.startingBalance = 0;
    }
    rrsp.startingBalance = 500_000;

    const { rows, warnings } = buildFor(scenario, dependent);

    expect(rows[0].withdrawals[rrsp.id] ?? 0).toBe(0);
    expect(rows[0].contributions[tfsa.id] ?? 0).toBe(0);
    expect(warnings[0].message).toMatch(/Contributions short by/);
  });

  it('does not let an account fund a contribution out of one it just received', () => {
    // Money going in a circle: A credits B, then B pays for C. Nothing is
    // gained, but both legs get reported, which inflates the year's
    // contributions without the household being a dollar better off.
    const { scenario, earner, dependent, jointCash } = householdScenario();
    jointCash.startingBalance = 10_000;
    earner.annualIncomeNominal = 0;
    for (const b of earner.accountBuckets) b.annualContributionWhileWorking = 0;

    const nonRegistered = dependent.accountBuckets.find((b) => b.kind === 'CA_NON_REGISTERED')!;
    const tfsa = dependent.accountBuckets.find((b) => b.kind === 'CA_TFSA')!;
    for (const b of dependent.accountBuckets) {
      b.startingBalance = 0;
      b.annualContributionWhileWorking = 0;
    }
    nonRegistered.annualContributionWhileWorking = 10_000;
    tfsa.annualContributionWhileWorking = 10_000;

    const { rows } = buildFor(scenario, dependent);

    // The 10,000 of cash funds the non-registered contribution and stops
    // there. The TFSA gets nothing, because the only balance left in the
    // household arrived this year as a contribution.
    expect(rows[0].contributions[nonRegistered.id]).toBeCloseTo(10_000, 2);
    expect(rows[0].contributions[tfsa.id] ?? 0).toBe(0);
  });

  it('never leaves the household richer than what it earned, spent and grew', () => {
    // The whole point of funding them: a contribution moves money between two
    // accounts, so it can't change the household total on its own.
    const { scenario, earner, dependent, jointCash } = householdScenario();
    // Growth is already off; zero the tax and income too, so the household
    // total has nothing legitimate to change it by.
    earner.annualIncomeNominal = 0;
    for (const p of scenario.persons) {
      p.retirementStartYear = null;
    }
    setSpendingEach(scenario, { before: 0 });

    const opening =
      jointCash.startingBalance +
      scenario.persons.reduce((sum, p) => sum + p.accountBuckets.reduce((s, b) => s + b.startingBalance, 0), 0);

    const combined = combineLedgers(buildScenarioLedger(scenario, []), earner.id, scenario.sharedAccountBuckets);
    const allBuckets = [...scenario.persons.flatMap((p) => p.accountBuckets), jointCash];
    for (const row of combined.rows) {
      const total = allBuckets.reduce((sum, b) => sum + (row.accountEnd[b.id] ?? 0), 0);
      expect(total).toBeCloseTo(opening, 2);
    }
    // ...and the contributions genuinely happened, rather than the total
    // holding because nothing moved at all.
    expect(dependent.accountBuckets.reduce((sum, b) => sum + (combined.rows[0].contributions[b.id] ?? 0), 0)).toBeGreaterThan(0);
  });

  it('stops a contribution at retirement unless the account is flagged to keep taking them', () => {
    // A TFSA accrues room every year whether or not you're working, so a
    // retiree keeps topping it up out of cash - an RRSP alongside it doesn't.
    const { scenario, dependent, jointCash } = householdScenario();
    for (const p of scenario.persons) {
      p.retirementStartYear = startYear;
    }
    setSpendingEach(scenario, { atRetirement: 0 });
    const tfsa = dependent.accountBuckets.find((b) => b.kind === 'CA_TFSA')!;
    const rrsp = dependent.accountBuckets.find((b) => b.kind === 'CA_RRSP_RRIF')!;
    tfsa.contributeInRetirement = true;

    const row = buildFor(scenario, dependent).rows[0];

    expect(row.isRetired).toBe(true);
    expect(row.contributions[tfsa.id]).toBeCloseTo(7_000, 2);
    expect(row.contributions[rrsp.id] ?? 0).toBe(0);
    // Paid for, in retirement too - out of the joint cash, not minted.
    expect(row.withdrawals[jointCash.id]).toBeCloseTo(7_000, 2);
  });

  it('keeps a shared account contributing past the last retirement only when flagged', () => {
    const { scenario, jointCash } = householdScenario();
    const jointTfsa: AccountBucket = {
      id: 'joint-tfsa',
      label: 'Joint Savings',
      country: 'CA',
      kind: 'CA_NON_REGISTERED',
      taxTreatment: 'taxable',
      startingBalance: 0,
      isCashBuffer: false,
      annualContributionWhileWorking: 5_000,
    };
    scenario.sharedAccountBuckets = [jointCash, jointTfsa];
    for (const p of scenario.persons) {
      p.retirementStartYear = startYear;
      for (const b of p.accountBuckets) b.annualContributionWhileWorking = 0;
    }
    setSpendingEach(scenario, { atRetirement: 0 });

    const stopped = buildScenarioLedger(scenario, [])[0].result.rows[0];
    expect(stopped.contributions[jointTfsa.id] ?? 0).toBe(0);

    jointTfsa.contributeInRetirement = true;
    const continued = buildScenarioLedger(scenario, [])[0].result.rows[0];
    expect(continued.contributions[jointTfsa.id]).toBeCloseTo(5_000, 2);
    expect(continued.withdrawals[jointCash.id]).toBeCloseTo(5_000, 2);
  });

  it('funds a shared account’s own contribution from shared cash, once for the household', () => {
    const { scenario, jointCash } = householdScenario();
    const jointBrokerage: AccountBucket = {
      id: 'joint-brokerage',
      label: 'Joint Brokerage',
      country: 'CA',
      kind: 'CA_NON_REGISTERED',
      taxTreatment: 'taxable',
      startingBalance: 0,
      isCashBuffer: false,
      annualContributionWhileWorking: 15_000,
    };
    scenario.sharedAccountBuckets = [jointCash, jointBrokerage];
    for (const p of scenario.persons) {
      for (const b of p.accountBuckets) b.annualContributionWhileWorking = 0;
    }

    const ledgers = buildScenarioLedger(scenario, []);
    const primary = ledgers[0].result.rows[0];
    const other = ledgers[1].result.rows[0];

    // Credited once, on the primary row, with the debit that paid for it
    // alongside - not once per person.
    expect(primary.contributions[jointBrokerage.id]).toBeCloseTo(15_000, 2);
    expect(primary.withdrawals[jointCash.id]).toBeCloseTo(15_000, 2);
    expect(other.contributions[jointBrokerage.id] ?? 0).toBe(0);
    expect(other.withdrawals[jointCash.id] ?? 0).toBe(0);
    expect(primary.accountEnd[jointBrokerage.id]).toBeCloseTo(15_000, 2);
    expect(primary.accountEnd[jointCash.id]).toBeCloseTo(400_000 - 15_000, 2);
  });
});

describe('age-gated accounts', () => {
  it('skips an account below its available age and uses it once old enough', () => {
    const scenario = createDefaultScenario('US');
    const person = scenario.persons[0];
    const startYear = new Date().getFullYear();
    const currentAge = startYear - person.birthYear;

    person.retirementStartYear = startYear;
    setSpending(scenario, { atRetirement: [40_000] });
    person.benefits = [];
    person.planningEndAge = 70;
    person.cashBufferRule = { ...person.cashBufferRule, enabled: false };
    scenario.returnRates = { ...NO_GROWTH };
    for (const b of person.accountBuckets) b.annualContributionWhileWorking = 0;
    // Only the 401(k) has money, and it's gated at 59.5.
    const traditional = person.accountBuckets.find((b) => b.kind === 'US_TRADITIONAL_401K_IRA')!;
    for (const b of person.accountBuckets) b.startingBalance = b.id === traditional.id ? 2_000_000 : 0;
    expect(availableFromAgeFor(traditional)).toBe(59.5);
    expect(currentAge).toBeLessThan(59.5);

    const { rows, warnings } = buildScenarioLedger(scenario, [])[0].result;
    const beforeAge = rows.filter((r) => r.age < 59.5);
    const afterAge = rows.filter((r) => r.age >= 59.5);

    // Too young: the balance is untouchable, so the plan shortfalls...
    expect(beforeAge.every((r) => (r.withdrawals[traditional.id] ?? 0) === 0)).toBe(true);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].message).toMatch(/not yet available at age/);
    // ...and once old enough it's drawn on normally.
    expect(afterAge.some((r) => (r.withdrawals[traditional.id] ?? 0) > 0)).toBe(true);
  });

  it('blocks a meltdown from an account the person is too young to reach', () => {
    const scenario = createDefaultScenario('US');
    const person = scenario.persons[0];
    const startYear = new Date().getFullYear();
    person.retirementStartYear = startYear;
    setSpending(scenario, { atRetirement: [0] });
    person.benefits = [];
    person.planningEndAge = startYear - person.birthYear + 2;

    const traditional = person.accountBuckets.find((b) => b.kind === 'US_TRADITIONAL_401K_IRA')!;
    person.meltdownRules = [
      { accountBucketId: traditional.id, enabled: true, targetTaxableIncomeCeiling: 50_000, startYear, endYear: null, destinationAccountBucketId: null },
    ];

    const rows = buildScenarioLedger(scenario, [])[0].result.rows;
    expect(startYear - person.birthYear).toBeLessThan(59.5);
    expect(rows.every((r) => r.meltdownWithdrawalTotal === 0)).toBe(true);
  });
});
