import { describe, expect, it } from 'vitest';
import { createDemoScenarios } from './demoScenarios';
import { buildScenarioLedger } from './ledger';
import { combineLedgers } from './combineLedgers';
import { convertBucketAmountToScenarioCurrency } from './currency';
import { ScenarioSchema } from './schema';
import { checkLedgerInvariants, formatViolations } from './invariants';
import type { AccountBucket, Scenario } from './schema';

/**
 * Same balance-sheet check `invariants.test.ts` runs on hand-built scenarios,
 * reused here so a demo scenario is held to the same bar rather than just
 * "doesn't throw" - this is what a real user's first impression of the app
 * looks like, so it should be numerically sound, not merely schema-valid.
 */
function expectNoViolations(scenario: Scenario) {
  const ledgers = buildScenarioLedger(scenario, []);
  const shared = scenario.sharedAccountBuckets;
  const sharedBucketIds = new Set(shared.map((b) => b.id));
  const openingFor = (buckets: AccountBucket[]) =>
    Object.fromEntries(buckets.map((b) => [b.id, convertBucketAmountToScenarioCurrency(b.startingBalance, b, scenario)]));

  for (const ledger of ledgers) {
    const buckets = [...ledger.plan.accountBuckets, ...shared];
    const violations = checkLedgerInvariants({ rows: ledger.result.rows, buckets, openingBalances: openingFor(buckets), sharedBucketIds });
    expect(violations.length, `${ledger.plan.label}: ${formatViolations(violations)}`).toBe(0);
  }

  const allBuckets = [...scenario.persons.flatMap((p) => p.accountBuckets), ...shared];
  const combined = combineLedgers(ledgers, scenario.persons[0].id, shared);
  const combinedViolations = checkLedgerInvariants({
    rows: combined.rows,
    buckets: allBuckets,
    openingBalances: openingFor(allBuckets),
    sharedBucketIds,
    combined: true,
  });
  expect(combinedViolations.length, `Combined: ${formatViolations(combinedViolations)}`).toBe(0);
}

describe('createDemoScenarios', () => {
  const scenarios = createDemoScenarios();

  it('returns exactly four scenarios with distinct ids', () => {
    expect(scenarios).toHaveLength(4);
    expect(new Set(scenarios.map((s) => s.id)).size).toBe(4);
  });

  it.each(createDemoScenarios())('"$name" validates against ScenarioSchema', (scenario) => {
    expect(() => ScenarioSchema.parse(scenario)).not.toThrow();
  });

  it.each(createDemoScenarios())('"$name" builds a ledger with no balance-sheet violations', (scenario) => {
    expectNoViolations(scenario);
  });

  it('every account referenced in a replenishment order actually belongs to that person', () => {
    for (const scenario of scenarios) {
      for (const person of scenario.persons) {
        const ownIds = new Set([...person.accountBuckets, ...scenario.sharedAccountBuckets].map((b) => b.id));
        for (const id of person.cashBufferRule.replenishmentOrder) expect(ownIds.has(id)).toBe(true);
      }
    }
  });

  it('the US single scenario is a lone filer with a real income and a graduated state table', () => {
    const scenario = scenarios.find((s) => s.name === 'US Single Filer')!;
    expect(scenario.persons).toHaveLength(1);
    expect(scenario.taxConfig.filingStatus).toBe('single');
    expect(scenario.persons[0].annualIncomeNominal).toBeGreaterThan(0);
    expect(scenario.taxConfig.stateOrProvincialTable.brackets.length).toBeGreaterThan(1);
  });

  it('the US couple scenario files jointly with a federal table that matches', () => {
    const scenario = scenarios.find((s) => s.name === 'US Married Couple (MFJ)')!;
    expect(scenario.persons).toHaveLength(2);
    expect(scenario.taxConfig.filingStatus).toBe('marriedFilingJointly');
    expect(scenario.taxConfig.federalTable.filingStatus).toBe('marriedFilingJointly');
    expect(scenario.persons.every((p) => p.annualIncomeNominal > 0)).toBe(true);
  });

  it('the cross-border couple holds both US and CA account kinds under Canadian tax residency', () => {
    const scenario = scenarios.find((s) => s.name === 'Cross-Border Couple (Canada + US Accounts)')!;
    expect(scenario.country).toBe('CA');
    expect(scenario.taxConfig.country).toBe('CA');
    const [earner, dependent] = scenario.persons;
    const earnerCountries = new Set(earner.accountBuckets.map((b) => b.country));
    expect(earnerCountries.has('US')).toBe(true);
    expect(earnerCountries.has('CA')).toBe(true);
    // Single-income household: only the earner has salary; the dependent spouse has none.
    expect(earner.annualIncomeNominal).toBeGreaterThan(0);
    expect(dependent.annualIncomeNominal).toBe(0);
  });

  it('the Canadian couple retires its two earners in different years, on Canadian accounts only', () => {
    const scenario = scenarios.find((s) => s.name.startsWith('Canadian Couple'))!;
    expect(scenario.country).toBe('CA');
    expect(scenario.taxConfig.country).toBe('CA');
    // Canada has no joint return - each spouse walks their own brackets.
    expect(scenario.taxConfig.filingStatus).toBe('single');
    expect(scenario.taxConfig.stateOrProvincialTable.label).toBe('British Columbia');

    const [first, second] = scenario.persons;
    // Two earners, unlike the single-income cross-border couple.
    expect(first.annualIncomeNominal).toBeGreaterThan(0);
    expect(second.annualIncomeNominal).toBeGreaterThan(0);

    // The point of this demo: the household does NOT retire in one step.
    expect(first.retirementStartYear).not.toBe(second.retirementStartYear);

    // Canadian accounts only - no cross-border holdings here.
    const countries = new Set(scenario.persons.flatMap((p) => p.accountBuckets).map((b) => b.country));
    expect([...countries]).toEqual(['CA']);
  });

  // A first-time visitor sees these scenarios before anything else, so a wall
  // of red warnings on load is a product defect even when the arithmetic
  // underneath is right.
  describe('load clean', () => {
    it.each([
      'US Single Filer',
      'US Married Couple (MFJ)',
      'Cross-Border Couple (Canada + US Accounts)',
      'Canadian Couple (BC, Staggered Retirement)',
    ])('%s projects without any warnings', (name) => {
      const scenario = scenarios.find((s) => s.name === name)!;
      for (const { plan, result } of buildScenarioLedger(scenario, [])) {
        expect(result.warnings, `${name} / ${plan.label}: ${result.warnings.map((w) => `${w.year} ${w.message}`).join(' | ')}`).toEqual([]);
      }
    });

    // The specific misconfiguration that produced 29 identical notices per
    // person: the surplus lands in an account that also has its own scheduled
    // contribution, so the same dollars are claimed twice and the engine
    // (correctly) refuses to fund the second claim.
    it('never points a surplus destination at an account that also has a scheduled contribution', () => {
      for (const scenario of scenarios) {
        for (const person of scenario.persons) {
          const destination = person.accountBuckets.find((b) => b.id === person.surplusDestinationAccountBucketId);
          if (!destination) continue;
          expect(destination.annualContributionWhileWorking, `${scenario.name} / ${person.label} / ${destination.label}`).toBe(0);
        }
      }
    });

    it('still banks the surplus somewhere taxable rather than leaving it in cash', () => {
      for (const scenario of scenarios) {
        for (const person of scenario.persons) {
          if (person.annualIncomeNominal <= 0) continue;
          const destination = person.accountBuckets.find((b) => b.id === person.surplusDestinationAccountBucketId);
          expect(destination, `${scenario.name} / ${person.label} has no surplus destination`).toBeDefined();
          expect(destination!.taxTreatment, `${scenario.name} / ${person.label}`).toBe('taxable');
          // Optional in the schema, so absent means "not a cash buffer".
          expect(destination!.isCashBuffer).toBeFalsy();
        }
      }
    });
  });

  describe('describe plausible households', () => {
    it('every scenario spends something before retiring', () => {
      // The demos used to spend nothing at all until the day they retired,
      // which made every working year pure accumulation.
      for (const scenario of scenarios) {
        expect(scenario.householdSpendingRealBeforeRetirement, scenario.name).toBeGreaterThan(0);
      }
    });

    it('scales starting balances to income rather than to the seed defaults', () => {
      // `SEED_AMOUNTS_BY_KIND` gives every new person $730k, which against a
      // $95k salary described an heir rather than a saver. Asserted as a ratio
      // so it keeps meaning something if the salaries are ever retuned.
      for (const scenario of scenarios) {
        const income = scenario.persons.reduce((sum, p) => sum + (p.annualIncomeNominal ?? 0), 0);
        const balances = scenario.persons.flatMap((p) => p.accountBuckets).reduce((sum, b) => sum + (b.startingBalance ?? 0), 0);
        expect(balances / income, `${scenario.name}: ${Math.round(balances)} on ${Math.round(income)} income`).toBeLessThan(2.5);
      }
    });

    // Each demo takes a different position on the replacement ratio, so between
    // them they show the shapes a real plan can have.
    it.each([
      ['US Single Filer', 'lower'],
      ['US Married Couple (MFJ)', 'same'],
      ['Cross-Border Couple (Canada + US Accounts)', 'higher'],
      ['Canadian Couple (BC, Staggered Retirement)', 'lower'],
    ] as const)('%s spends %s in retirement than before it', (name, direction) => {
      const scenario = scenarios.find((s) => s.name === name)!;
      const before = scenario.householdSpendingRealBeforeRetirement;
      const after = scenario.householdSpendingRealAtRetirement;
      if (direction === 'lower') expect(after).toBeLessThan(before);
      else if (direction === 'same') expect(after).toBe(before);
      else expect(after).toBeGreaterThan(before);
    });

    it('leaves every scenario solvent at the end of the projection', () => {
      // Asserted on the HOUSEHOLD, not per person. One member's accounts
      // reaching zero is ordinary - the withdrawal order drains accounts in
      // sequence, and the cross-border couple's non-earning spouse holds only a
      // small TFSA that is spent well before the projection ends. What must not
      // happen is the household as a whole running out, which would have
      // emitted a spending shortfall.
      for (const scenario of scenarios) {
        const ledgers = buildScenarioLedger(scenario, []);
        const household = ledgers.reduce((sum, l) => sum + l.result.rows[l.result.rows.length - 1].totalNetWorth, 0);
        expect(household, `${scenario.name} ends at ${Math.round(household)}`).toBeGreaterThan(0);
        for (const { plan, result } of ledgers) {
          const final = result.rows[result.rows.length - 1];
          expect(final.totalNetWorth, `${scenario.name} / ${plan.label} went negative`).toBeGreaterThanOrEqual(0);
        }
      }
    });

    // The three endgames must stay visibly different, or the varied-replacement
    // design above is invisible in the output.
    //
    // Measured in REAL terms and against the balance at retirement, not against
    // the peak: post-retirement growth is 5% nominal against 2.5% inflation, so
    // a nominal balance climbs in almost every survivable plan and "ends below
    // its peak" is unreachable without absurd spending. What actually differs is
    // how much purchasing power the retirement years add or consume.
    it('gives the demos visibly different endgames', () => {
      const ratios = new Map<string, number>();
      for (const scenario of scenarios) {
        const ledgers = buildScenarioLedger(scenario, []);
        const years = ledgers[0].result.rows.map((r) => r.year);
        const inflation = 1 + (scenario.inflation.flatRatePct ?? 0) / 100;
        const realAt = (i: number) =>
          ledgers.reduce((sum, l) => sum + (l.result.rows[i]?.totalNetWorth ?? 0), 0) / Math.pow(inflation, years[i] - years[0]);
        const retirementIndex = years.indexOf(ledgers[0].plan.retirementStartYear!);
        ratios.set(scenario.name, realAt(years.length - 1) / realAt(retirementIndex));
      }

      const single = ratios.get('US Single Filer')!;
      const couple = ratios.get('US Married Couple (MFJ)')!;
      const crossBorder = ratios.get('Cross-Border Couple (Canada + US Accounts)')!;

      // Spends least in retirement, so grows the most.
      expect(single, `single ${single.toFixed(2)}x`).toBeGreaterThan(1.4);
      // Spends the same throughout: still ahead, but visibly less so.
      expect(couple, `couple ${couple.toFixed(2)}x`).toBeGreaterThan(1.1);
      expect(couple, `couple ${couple.toFixed(2)}x should trail single ${single.toFixed(2)}x`).toBeLessThan(single);
      // Spends more in retirement, so consumes real purchasing power - the only
      // one that draws itself down.
      expect(crossBorder, `cross-border ${crossBorder.toFixed(2)}x`).toBeLessThan(1);

      // Nearly the same spending either side of retiring (~93% replacement), on
      // two full CPP and OAS entitlements which between them cover a large share
      // of it - so the portfolio is drawn on lightly and drifts up in real terms
      // rather than growing steeply or falling. Banded rather than pinned: what
      // matters is that it neither compounds like the single filer nor declines
      // like the cross-border couple.
      const canadian = ratios.get('Canadian Couple (BC, Staggered Retirement)')!;
      expect(canadian, `canadian ${canadian.toFixed(2)}x`).toBeGreaterThan(1);
      expect(canadian, `canadian ${canadian.toFixed(2)}x should trail single ${single.toFixed(2)}x`).toBeLessThan(single);
    });
  });
});
