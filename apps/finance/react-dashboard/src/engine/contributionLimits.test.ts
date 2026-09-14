import { describe, expect, it } from 'vitest';
import { usAnnualContributionCeiling, usContributionExcess } from './contributionLimits';
import { createFundedPersonPlan, createFundedScenario } from './testFixtures';
import { buildScenarioLedger } from './ledger';
import type { PersonPlan, Scenario } from './schema';

/** 2026 statutory figures: 401(k) 24,500 + IRA 7,500, plus catch-ups from 50. */
const BASE = 24_500 + 7_500;

describe('usAnnualContributionCeiling', () => {
  it('is both vehicles combined before any catch-up applies', () => {
    expect(usAnnualContributionCeiling(35, 1)).toBe(BASE);
    expect(usAnnualContributionCeiling(49, 1)).toBe(BASE);
  });

  it('adds the ordinary catch-up from 50', () => {
    expect(usAnnualContributionCeiling(50, 1)).toBe(BASE + 8_000 + 1_100);
    expect(usAnnualContributionCeiling(59, 1)).toBe(BASE + 8_000 + 1_100);
  });

  // SECURE 2.0's higher band is 60 to 63 inclusive, and reverts at 64 - a
  // window narrow enough that an off-by-one at either end is easy to miss.
  it('uses the higher 60-to-63 catch-up only inside that window', () => {
    expect(usAnnualContributionCeiling(60, 1)).toBe(BASE + 11_250 + 1_100);
    expect(usAnnualContributionCeiling(63, 1)).toBe(BASE + 11_250 + 1_100);
    expect(usAnnualContributionCeiling(64, 1)).toBe(BASE + 8_000 + 1_100);
  });

  // Left un-indexed, every long projection would breach this around year
  // twenty purely because the contribution indexed and the limit did not.
  it('indexes with inflation', () => {
    expect(usAnnualContributionCeiling(35, 1.5)).toBeGreaterThan(BASE * 1.4);
  });

  // Exact at factor 1 rather than snapped to a step: the components don't
  // share one (401(k) moves in 500s, the IRA catch-up in 100s, the 60-to-63
  // catch-up is 11,250), so rounding their sum would misstate the real figure.
  it('reports the exact statutory figure when nothing has been indexed yet', () => {
    expect(usAnnualContributionCeiling(50, 1) % 500).not.toBe(0);
    expect(usAnnualContributionCeiling(50, 1)).toBe(41_100);
  });
});

function usPersonContributing(amounts: Partial<Record<string, number>>): PersonPlan {
  const person = createFundedPersonPlan('US', 'Person 1');
  for (const bucket of person.accountBuckets) {
    bucket.annualContributionWhileWorking = amounts[bucket.kind] ?? 0;
    bucket.indexContributionToInflation = false;
  }
  return person;
}

describe('usContributionExcess', () => {
  it('is zero for a plan inside the limit', () => {
    const person = usPersonContributing({ US_TRADITIONAL_401K_IRA: 20_000, US_ROTH_401K_IRA: 5_000 });
    expect(usContributionExcess(person, 35, false, 1).excess).toBe(0);
  });

  // Traditional and Roth share the statutory limits rather than each having
  // their own, so splitting a contribution across them is not a way around it.
  it('counts traditional and Roth against the same ceiling', () => {
    const person = usPersonContributing({ US_TRADITIONAL_401K_IRA: 20_000, US_ROTH_401K_IRA: 20_000 });
    const { excess, contributed } = usContributionExcess(person, 35, false, 1);
    expect(contributed).toBe(40_000);
    expect(excess).toBe(40_000 - BASE);
  });

  it('ignores taxable and cash accounts, which have no limit at all', () => {
    const person = usPersonContributing({ US_TAXABLE_BROKERAGE: 500_000, US_CASH_HYSA: 500_000 });
    expect(usContributionExcess(person, 35, false, 1).contributed).toBe(0);
  });

  it('ignores a contribution retirement has already stopped', () => {
    const person = usPersonContributing({ US_TRADITIONAL_401K_IRA: 99_000 });
    for (const b of person.accountBuckets) b.contributeInRetirement = false;
    expect(usContributionExcess(person, 70, true, 1).excess).toBe(0);
    // ...but still counts one flagged to carry on past retirement.
    for (const b of person.accountBuckets) b.contributeInRetirement = true;
    expect(usContributionExcess(person, 70, true, 1).excess).toBeGreaterThan(0);
  });

  it('lets an older person contribute more before breaching', () => {
    const person = usPersonContributing({ US_TRADITIONAL_401K_IRA: 40_000 });
    expect(usContributionExcess(person, 35, false, 1).excess).toBeGreaterThan(0);
    expect(usContributionExcess(person, 61, false, 1).excess).toBe(0);
  });
});

describe('the over-limit warning in a real projection', () => {
  function usScenarioContributing(amount: number): Scenario {
    const scenario = createFundedScenario('US');
    const person = scenario.persons[0];
    person.annualIncomeNominal = 300_000;
    person.retirementStartYear = person.birthYear + 65;
    for (const bucket of person.accountBuckets) {
      bucket.annualContributionWhileWorking = bucket.kind === 'US_TRADITIONAL_401K_IRA' ? amount : 0;
      bucket.indexContributionToInflation = false;
    }
    return scenario;
  }

  function overLimitWarnings(scenario: Scenario) {
    return buildScenarioLedger(scenario, [])[0].result.warnings.filter((w) => w.code === 'contribution.overStatutoryLimit');
  }

  it('fires while the plan is over the limit', () => {
    const warnings = overLimitWarnings(usScenarioContributing(100_000));
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].amount).toBeGreaterThan(60_000);
    expect(warnings[0].message).toContain('100,000');
  });

  it('stays silent on a plan inside the limit', () => {
    expect(overLimitWarnings(usScenarioContributing(20_000))).toEqual([]);
  });

  // The whole reason this is a warning and not a cap: it tells you the figures
  // are optimistic without quietly rewriting the plan you typed.
  it('does not change the projection it warns about', () => {
    const scenario = usScenarioContributing(100_000);
    const rows = buildScenarioLedger(scenario, [])[0].result.rows;
    const traditional = scenario.persons[0].accountBuckets.find((b) => b.kind === 'US_TRADITIONAL_401K_IRA')!;
    expect(rows[0].contributions[traditional.id]).toBeCloseTo(100_000, 0);
  });

  // A Canadian plan over one year's RRSP limit is usually legitimate, because
  // unused room carries forward - so this must not fire on it.
  it('never fires on Canadian accounts', () => {
    const scenario = createFundedScenario('CA');
    const person = scenario.persons[0];
    person.annualIncomeNominal = 300_000;
    person.retirementStartYear = person.birthYear + 65;
    for (const bucket of person.accountBuckets) {
      bucket.annualContributionWhileWorking = bucket.taxTreatment === 'taxable' ? 0 : 100_000;
    }
    expect(overLimitWarnings(scenario)).toEqual([]);
  });
});
