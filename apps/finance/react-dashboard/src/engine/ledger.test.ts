import { describe, expect, it } from 'vitest';
import { buildLedger } from './ledger';
import { createDefaultScenario } from './defaults';
import { generateId } from './id';

describe('buildLedger', () => {
  it('produces one row per year from now through planningEndAge', () => {
    const scenario = createDefaultScenario('US');
    const person1 = scenario.household.persons[0];
    const { rows } = buildLedger(scenario, []);
    const expectedYears = person1.planningEndAge - (new Date().getFullYear() - person1.birthYear) + 1;
    expect(rows).toHaveLength(expectedYears);
    expect(rows[0].year).toBe(new Date().getFullYear());
  });

  it('has zero spending and zero withdrawals before retirement starts and before any benefit is claimable', () => {
    const scenario = createDefaultScenario('US');
    const person1 = scenario.household.persons[0];
    // Default SS claim age is 67; cap the projection well before that so
    // benefit-driven tax withdrawals (a real, separate behavior - see the
    // next test) don't confound this "no retirement yet" check.
    person1.planningEndAge = new Date().getFullYear() - person1.birthYear + 10;
    const { rows } = buildLedger(scenario, []);
    expect(rows.every((r) => !r.isRetired)).toBe(true);
    expect(rows.every((r) => r.spendingNominal === 0)).toBe(true);
    expect(rows.every((r) => Object.keys(r.withdrawals).length === 0)).toBe(true);
  });

  it('still taxes and withdraws to fund a claimed benefit even if no retirement year has been set', () => {
    const scenario = createDefaultScenario('US');
    const person1 = scenario.household.persons[0];
    const ssBenefit = scenario.benefits.find((b) => b.type === 'US_SOCIAL_SECURITY')!;
    const currentAge = new Date().getFullYear() - person1.birthYear;
    person1.planningEndAge = ssBenefit.claimAge + 2;
    const { rows } = buildLedger(scenario, []);

    const beforeClaim = rows.filter((r) => r.age < ssBenefit.claimAge);
    const afterClaim = rows.filter((r) => r.age >= ssBenefit.claimAge);
    expect(currentAge).toBeLessThan(ssBenefit.claimAge);
    expect(beforeClaim.every((r) => r.benefits.length === 0)).toBe(true);
    expect(afterClaim.every((r) => r.benefits.length > 0)).toBe(true);
    expect(afterClaim.every((r) => !r.isRetired)).toBe(true);
  });

  it('starts spending and drawing down once a retirement year is set, growing net worth pre-retirement', () => {
    const scenario = createDefaultScenario('US');
    const person1 = scenario.household.persons[0];
    const startYear = new Date().getFullYear();
    person1.retirementStartYear = startYear + 5;
    const { rows } = buildLedger(scenario, []);

    const preRetirementRows = rows.filter((r) => !r.isRetired);
    const retirementRows = rows.filter((r) => r.isRetired);
    expect(preRetirementRows).toHaveLength(5);
    expect(retirementRows.length).toBeGreaterThan(0);

    // Net worth should grow pre-retirement given positive default return/contribution assumptions.
    expect(preRetirementRows.at(-1)!.totalNetWorth).toBeGreaterThan(preRetirementRows[0].totalNetWorth);

    // First retirement year's nominal spending equals the real target (no inflation compounded yet).
    expect(retirementRows[0].spendingNominal).toBeCloseTo(scenario.annualSpendingRealAtRetirement, 5);
  });

  it("resolves a second person's benefit claim age against their own birth year, not Person 1's age", () => {
    const scenario = createDefaultScenario('CA');
    const person1 = scenario.household.persons[0];
    const person1BirthYear = person1.birthYear;
    const person2BirthYear = person1BirthYear - 5; // person 2 is 5 years older
    const person2 = {
      id: generateId('person'),
      label: 'Person 2',
      birthYear: person2BirthYear,
      planningEndAge: 95,
      retirementStartYear: null,
      annualIncomeNominal: 0,
      incomeGrowthRatePct: 0,
    };
    scenario.household.persons.push(person2);

    const cpp = scenario.benefits.find((b) => b.type === 'CA_CPP')!;
    cpp.personId = person2.id;
    cpp.claimAge = 65;
    // Person 2 is older, so their claim year (person2BirthYear + claimAge) falls
    // at a HIGHER Person-1 age than 65 - the window must reach past it.
    person1.planningEndAge = person2BirthYear + cpp.claimAge - person1BirthYear + 2;

    const { rows } = buildLedger(scenario, []);
    const person2ClaimYear = person2BirthYear + cpp.claimAge;

    const beforePerson2Claims = rows.filter((r) => r.year < person2ClaimYear);
    const afterPerson2Claims = rows.filter((r) => r.year >= person2ClaimYear);
    expect(beforePerson2Claims.every((r) => !r.benefits.some((b) => b.type === 'CA_CPP'))).toBe(true);
    expect(afterPerson2Claims.some((r) => r.benefits.some((b) => b.type === 'CA_CPP'))).toBe(true);

    // Person 1's own age at Person 2's claim year is NOT 65 (since Person 2
    // is 5 years older) - confirms the age used wasn't the shared one.
    const rowAtPerson2Claim = rows.find((r) => r.year === person2ClaimYear)!;
    expect(rowAtPerson2Claim.age).not.toBe(cpp.claimAge);
  });

  it("claws back OAS using the PRIOR year's taxable income, not the current year's", () => {
    const scenario = createDefaultScenario('CA');
    const person1 = scenario.household.persons[0];
    const currentAge = new Date().getFullYear() - person1.birthYear;
    const oas = scenario.benefits.find((b) => b.type === 'CA_OAS')!;
    oas.claimAge = currentAge; // claimable starting the very first projected year
    person1.planningEndAge = currentAge + 3;
    // A huge income source active only in year 1 pushes that year's taxable
    // income far past the clawback threshold, with nothing to claw back yet
    // (no prior year exists) - year 2 should then show the clawback.
    const firstYear = new Date().getFullYear();
    scenario.incomeSources = [{ id: 'big-income', label: 'One-time income', startYear: firstYear, endYear: firstYear, annualAmountNominal: 500_000, growthRatePct: 0 }];

    const { rows } = buildLedger(scenario, []);
    const year1 = rows.find((r) => r.year === firstYear)!;
    const year2 = rows.find((r) => r.year === firstYear + 1)!;

    const oasAmountYear1 = year1.benefits.find((b) => b.type === 'CA_OAS')?.amount ?? 0;
    const oasAmountYear2 = year2.benefits.find((b) => b.type === 'CA_OAS')?.amount ?? 0;

    expect(oasAmountYear1).toBeCloseTo(oas.monthlyBenefitAtClaimAge * 12, 5); // full amount - no prior year to claw back from
    expect(oasAmountYear2).toBeLessThan(oasAmountYear1); // year 2 pays for year 1's high income
  });

  it("stops a person's income exactly at their own retirement start year", () => {
    const scenario = createDefaultScenario('US');
    const person1 = scenario.household.persons[0];
    const startYear = new Date().getFullYear();
    person1.annualIncomeNominal = 100_000;
    person1.incomeGrowthRatePct = 0;
    person1.retirementStartYear = startYear + 3;
    person1.planningEndAge = new Date().getFullYear() - person1.birthYear + 10;

    const { rows } = buildLedger(scenario, []);
    const beforeRetirement = rows.filter((r) => r.year < startYear + 3);
    const afterRetirement = rows.filter((r) => r.year >= startYear + 3);

    expect(beforeRetirement.every((r) => r.incomes.find((i) => i.sourceId === person1.id)!.amount === 100_000)).toBe(true);
    expect(afterRetirement.every((r) => r.incomes.find((i) => i.sourceId === person1.id)!.amount === 0)).toBe(true);
  });

  it('extends the projection horizon to cover whichever person has the latest birthYear + planningEndAge', () => {
    const scenario = createDefaultScenario('US');
    const person1 = scenario.household.persons[0];
    person1.planningEndAge = 70; // shorter than the younger person below
    const youngerPerson = {
      id: generateId('person'),
      label: 'Person 2',
      birthYear: person1.birthYear + 20, // 20 years younger
      planningEndAge: 90,
      retirementStartYear: null,
      annualIncomeNominal: 0,
      incomeGrowthRatePct: 0,
    };
    scenario.household.persons.push(youngerPerson);

    const { rows } = buildLedger(scenario, []);
    const lastRow = rows.at(-1)!;
    const expectedHorizonEndYear = Math.max(person1.birthYear + person1.planningEndAge, youngerPerson.birthYear + youngerPerson.planningEndAge);
    expect(lastRow.year).toBe(expectedHorizonEndYear);
    // The Age column still reflects Person 1, even past their own planningEndAge.
    expect(lastRow.age).toBe(expectedHorizonEndYear - person1.birthYear);
  });

  it('melts down a tax-deferred bucket up to the target ceiling only within the configured window, reinvesting after-tax surplus', () => {
    const scenario = createDefaultScenario('CA');
    const person1 = scenario.household.persons[0];
    const startYear = new Date().getFullYear();
    person1.retirementStartYear = startYear;
    scenario.annualSpendingRealAtRetirement = 0; // isolate the meltdown's own effect from ordinary spending withdrawals

    const rrsp = scenario.accountBuckets.find((b) => b.kind === 'CA_RRSP_RRIF')!;
    const tfsa = scenario.accountBuckets.find((b) => b.kind === 'CA_TFSA')!;
    scenario.meltdownRule = {
      enabled: true,
      sourceAccountBucketIds: [rrsp.id],
      targetTaxableIncomeCeiling: 40_000,
      startYear,
      endYear: startYear + 1,
      destinationAccountBucketId: tfsa.id,
    };
    person1.planningEndAge = new Date().getFullYear() - person1.birthYear + 4;

    const { rows } = buildLedger(scenario, []);
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

  it('applies a GridOverride for spendingNominal without disturbing other years', () => {
    const scenario = createDefaultScenario('US');
    const person1 = scenario.household.persons[0];
    const startYear = new Date().getFullYear();
    person1.retirementStartYear = startYear;
    const overrideYear = startYear + 2;

    const { rows: baseline } = buildLedger(scenario, []);
    const { rows: withOverride } = buildLedger(scenario, [
      { id: 'o1', scenarioId: scenario.id, year: overrideYear, field: 'spendingNominal', value: 999_999, note: undefined, createdAt: new Date().toISOString() },
    ]);

    const overriddenRow = withOverride.find((r) => r.year === overrideYear)!;
    expect(overriddenRow.spendingNominal).toBe(999_999);
    expect(overriddenRow.overriddenFields).toContain('spendingNominal');

    const nextYearBaseline = baseline.find((r) => r.year === overrideYear + 1)!;
    const nextYearOverridden = withOverride.find((r) => r.year === overrideYear + 1)!;
    expect(nextYearOverridden.spendingNominal).toBeCloseTo(nextYearBaseline.spendingNominal, 5);
  });
});
