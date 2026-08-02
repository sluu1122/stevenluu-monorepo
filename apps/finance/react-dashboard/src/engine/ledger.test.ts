import { describe, expect, it } from 'vitest';
import { buildLedger } from './ledger';
import { createDefaultScenario } from './defaults';

describe('buildLedger', () => {
  it('produces one row per year from now through planningEndAge', () => {
    const scenario = createDefaultScenario('US');
    const { rows } = buildLedger(scenario, []);
    const expectedYears = scenario.planningEndAge - (new Date().getFullYear() - scenario.birthYear) + 1;
    expect(rows).toHaveLength(expectedYears);
    expect(rows[0].year).toBe(new Date().getFullYear());
  });

  it('has zero spending and zero withdrawals before retirement starts and before any benefit is claimable', () => {
    const scenario = createDefaultScenario('US');
    // Default SS claim age is 67; cap the projection well before that so
    // benefit-driven tax withdrawals (a real, separate behavior - see the
    // next test) don't confound this "no retirement yet" check.
    scenario.planningEndAge = new Date().getFullYear() - scenario.birthYear + 10;
    const { rows } = buildLedger(scenario, []);
    expect(rows.every((r) => !r.isRetired)).toBe(true);
    expect(rows.every((r) => r.spendingNominal === 0)).toBe(true);
    expect(rows.every((r) => Object.keys(r.withdrawals).length === 0)).toBe(true);
  });

  it('still taxes and withdraws to fund a claimed benefit even if no retirement year has been set', () => {
    const scenario = createDefaultScenario('US');
    const ssBenefit = scenario.benefits.find((b) => b.type === 'US_SOCIAL_SECURITY')!;
    const currentAge = new Date().getFullYear() - scenario.birthYear;
    scenario.planningEndAge = ssBenefit.claimAge + 2;
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
    const startYear = new Date().getFullYear();
    scenario.retirementStartYear = startYear + 5;
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

  it("resolves a spouse-owned benefit's claim age against the spouse's own birth year, not the primary person's age", () => {
    const scenario = createDefaultScenario('CA');
    const primaryBirthYear = scenario.birthYear;
    const spouseBirthYear = primaryBirthYear - 5; // spouse is 5 years older
    scenario.spouse = { birthYear: spouseBirthYear, retirementYear: null };

    const cpp = scenario.benefits.find((b) => b.type === 'CA_CPP')!;
    cpp.owner = 'spouse';
    cpp.claimAge = 65;
    // Spouse is older, so their claim year (spouseBirthYear + claimAge) falls
    // at a HIGHER primary-person age than 65 - the window must reach past it.
    scenario.planningEndAge = spouseBirthYear + cpp.claimAge - primaryBirthYear + 2;

    const { rows } = buildLedger(scenario, []);
    const spouseClaimYear = spouseBirthYear + cpp.claimAge;

    const beforeSpouseClaims = rows.filter((r) => r.year < spouseClaimYear);
    const afterSpouseClaims = rows.filter((r) => r.year >= spouseClaimYear);
    expect(beforeSpouseClaims.every((r) => !r.benefits.some((b) => b.type === 'CA_CPP'))).toBe(true);
    expect(afterSpouseClaims.some((r) => r.benefits.some((b) => b.type === 'CA_CPP'))).toBe(true);

    // The primary person's own age at the spouse's claim year is NOT 65 (since
    // the spouse is 5 years older) - confirms the age used wasn't the shared one.
    const rowAtSpouseClaim = rows.find((r) => r.year === spouseClaimYear)!;
    expect(rowAtSpouseClaim.age).not.toBe(cpp.claimAge);
  });

  it("claws back OAS using the PRIOR year's taxable income, not the current year's", () => {
    const scenario = createDefaultScenario('CA');
    const currentAge = new Date().getFullYear() - scenario.birthYear;
    const oas = scenario.benefits.find((b) => b.type === 'CA_OAS')!;
    oas.claimAge = currentAge; // claimable starting the very first projected year
    scenario.planningEndAge = currentAge + 3;
    // A huge income source active only in year 1 pushes that year's taxable
    // income far past the clawback threshold, with nothing to claw back yet
    // (no prior year exists) - year 2 should then show the clawback.
    const firstYear = new Date().getFullYear();
    scenario.incomeSources = [
      { id: 'big-income', label: 'One-time income', owner: 'self', startYear: firstYear, endYear: firstYear, annualAmountNominal: 500_000, growthRatePct: 0 },
    ];

    const { rows } = buildLedger(scenario, []);
    const year1 = rows.find((r) => r.year === firstYear)!;
    const year2 = rows.find((r) => r.year === firstYear + 1)!;

    const oasAmountYear1 = year1.benefits.find((b) => b.type === 'CA_OAS')?.amount ?? 0;
    const oasAmountYear2 = year2.benefits.find((b) => b.type === 'CA_OAS')?.amount ?? 0;

    expect(oasAmountYear1).toBeCloseTo(oas.monthlyBenefitAtClaimAge * 12, 5); // full amount - no prior year to claw back from
    expect(oasAmountYear2).toBeLessThan(oasAmountYear1); // year 2 pays for year 1's high income
  });

  it('applies a GridOverride for spendingNominal without disturbing other years', () => {
    const scenario = createDefaultScenario('US');
    const startYear = new Date().getFullYear();
    scenario.retirementStartYear = startYear;
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
