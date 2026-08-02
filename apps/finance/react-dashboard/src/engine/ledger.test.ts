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
