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

  it('returns exactly three scenarios with distinct ids', () => {
    expect(scenarios).toHaveLength(3);
    expect(new Set(scenarios.map((s) => s.id)).size).toBe(3);
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
});
