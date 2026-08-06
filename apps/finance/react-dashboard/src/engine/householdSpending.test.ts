import { describe, expect, it } from 'vitest';
import { buildScenarioLedger } from './ledger';
import { combineLedgers } from './combineLedgers';
import { checkLedgerInvariants, formatViolations } from './invariants';
import { createDefaultPersonPlan, createDefaultScenario } from './defaults';
import type { AccountKind, Scenario } from './schema';

const startYear = new Date().getFullYear();

/**
 * Two retired people, no income, growth and inflation off - so the household's
 * spending is the only thing moving money, and every figure is readable.
 */
/**
 * Turns non-registered account taxation off for a fixture measuring something
 * else. Distributions and realized gains are real taxable income, so leaving
 * them on would fold whatever the seeded accounts throw off into an assertion
 * that is about a different mechanism entirely.
 */
function withoutTaxableAccountTax(scenario: Scenario): void {
  scenario.taxableAccountTaxation = { ...scenario.taxableAccountTaxation, enabled: false };
}

function couple(): Scenario {
  const scenario = createDefaultScenario('CA');
  scenario.returnRates = { investmentsPreRetirementPct: 0, investmentsPostRetirementPct: 0, cashPreRetirementPct: 0, cashPostRetirementPct: 0 };
  scenario.inflation = { mode: 'flat', flatRatePct: 0 };
  withoutTaxableAccountTax(scenario);
  scenario.persons.push(createDefaultPersonPlan('CA', 'Person 2'));

  for (const person of scenario.persons) {
    person.retirementStartYear = startYear;
    person.planningEndAge = startYear - person.birthYear + 2;
    person.annualIncomeNominal = 0;
    person.benefits = [];
    person.cashBufferRule = { enabled: false, targetMonthsOfSpending: 6, replenishmentOrder: [] };
    person.requiredDistributionRule = { enabled: false, startAgeOverride: null, destinationAccountBucketId: null };
    for (const bucket of person.accountBuckets) bucket.annualContributionWhileWorking = 0;
  }
  scenario.householdSpendingRealAtRetirement = 100_000;
  return scenario;
}

const drawnFrom = (scenario: Scenario, kind: AccountKind) =>
  buildScenarioLedger(scenario, []).reduce((sum, ledger) => {
    const row = ledger.result.rows[0];
    return sum + ledger.plan.accountBuckets.filter((b) => b.kind === kind).reduce((s, b) => s + (row.withdrawals[b.id] ?? 0), 0);
  }, 0);

describe('household withdrawal order', () => {
  it('spends the household down by account kind, in the order given', () => {
    const scenario = couple();
    // Cash first, then non-registered - so with 100k of spending and 30k of
    // cash each, cash empties and the rest comes from non-registered alone.
    scenario.householdWithdrawalOrder = ['CA_CASH_POOL', 'CA_NON_REGISTERED', 'CA_RRSP_RRIF', 'CA_TFSA'];

    expect(drawnFrom(scenario, 'CA_CASH_POOL')).toBeCloseTo(60_000, 2);
    expect(drawnFrom(scenario, 'CA_NON_REGISTERED')).toBeCloseTo(40_000, 2);
    expect(drawnFrom(scenario, 'CA_RRSP_RRIF')).toBe(0);
    expect(drawnFrom(scenario, 'CA_TFSA')).toBe(0);
  });

  it('draws BOTH people’s accounts of a kind, not just one person’s', () => {
    // The reported bug: with a per-person waterfall, one partner's accounts
    // compounded untouched for decades while the other's carried the whole
    // budget. A household order reaches everyone's.
    const scenario = couple();
    scenario.householdWithdrawalOrder = ['CA_CASH_POOL', 'CA_NON_REGISTERED', 'CA_RRSP_RRIF', 'CA_TFSA'];

    const ledgers = buildScenarioLedger(scenario, []);
    const drawnBy = ledgers.map((l) => Object.values(l.result.rows[0].withdrawals).reduce((s, v) => s + v, 0));
    expect(drawnBy[0]).toBeGreaterThan(0);
    expect(drawnBy[1]).toBeGreaterThan(0);
    expect(drawnBy[0] + drawnBy[1]).toBeCloseTo(100_000, 2);
  });

  it('never touches a kind left out of the order', () => {
    // How a TFSA is kept for later: leave it off the list entirely.
    const scenario = couple();
    scenario.householdWithdrawalOrder = ['CA_CASH_POOL', 'CA_NON_REGISTERED', 'CA_RRSP_RRIF'];
    for (const person of scenario.persons) {
      for (const bucket of person.accountBuckets) {
        if (bucket.kind !== 'CA_TFSA' && bucket.kind !== 'CA_CASH_POOL') bucket.startingBalance = 0;
      }
    }

    const ledgers = buildScenarioLedger(scenario, []);
    expect(drawnFrom(scenario, 'CA_TFSA')).toBe(0);
    // ...and the plan says so rather than silently under-spending.
    expect(ledgers.some((l) => l.result.warnings.length > 0)).toBe(true);
  });

  it('taxes a draw from one person’s registered account to THAT person', () => {
    // Whoever the money is spent on, the CRA assesses the annuitant. Person 2
    // holds the only RRSP, so every dollar of tax has to be theirs.
    const scenario = couple();
    scenario.householdWithdrawalOrder = ['CA_RRSP_RRIF'];
    for (const [index, person] of scenario.persons.entries()) {
      for (const bucket of person.accountBuckets) {
        bucket.startingBalance = index === 1 && bucket.kind === 'CA_RRSP_RRIF' ? 2_000_000 : 0;
      }
    }

    const [first, second] = buildScenarioLedger(scenario, []).map((l) => l.result.rows[0]);
    expect(first.taxesPaid.total).toBe(0);
    expect(second.taxesPaid.total).toBeGreaterThan(0);
    // The withdrawal is reported on the owner's row, not the household's first.
    const rrsp = scenario.persons[1].accountBuckets.find((b) => b.kind === 'CA_RRSP_RRIF')!;
    expect(second.withdrawals[rrsp.id]).toBeGreaterThan(0);
    expect(first.withdrawals[rrsp.id]).toBeUndefined();
  });

  it('costs less tax spread over two people than concentrated in one', () => {
    // Two sets of brackets and two basic personal amounts instead of one.
    const totalTax = (balances: [number, number]) => {
      const scenario = couple();
      scenario.householdWithdrawalOrder = ['CA_RRSP_RRIF'];
      for (const [index, person] of scenario.persons.entries()) {
        for (const bucket of person.accountBuckets) {
          bucket.startingBalance = bucket.kind === 'CA_RRSP_RRIF' ? balances[index] : 0;
        }
      }
      return buildScenarioLedger(scenario, []).reduce((sum, l) => sum + l.result.rows[0].taxesPaid.total, 0);
    };

    expect(totalTax([1_000_000, 1_000_000])).toBeLessThan(totalTax([2_000_000, 0]));
  });

  it('keeps the balance sheet reconciling once draws cross between people', () => {
    // The check that catches mis-attribution: a draw has to appear on the row
    // of the account it left, or that person's Start and End stop agreeing.
    const scenario = couple();
    scenario.householdWithdrawalOrder = ['CA_CASH_POOL', 'CA_NON_REGISTERED', 'CA_RRSP_RRIF', 'CA_TFSA'];
    const ledgers = buildScenarioLedger(scenario, []);
    const opening = (buckets: { id: string; startingBalance: number }[]) =>
      Object.fromEntries(buckets.map((b) => [b.id, b.startingBalance]));

    for (const ledger of ledgers) {
      const buckets = [...ledger.plan.accountBuckets, ...scenario.sharedAccountBuckets];
      const violations = checkLedgerInvariants({ rows: ledger.result.rows, buckets, openingBalances: opening(buckets) });
      expect(violations.length, `${ledger.plan.label}: ${formatViolations(violations)}`).toBe(0);
    }

    const allBuckets = scenario.persons.flatMap((p) => p.accountBuckets);
    const combined = combineLedgers(ledgers, scenario.persons[0].id, scenario.sharedAccountBuckets);
    const combinedViolations = checkLedgerInvariants({ rows: combined.rows, buckets: allBuckets, openingBalances: opening(allBuckets), combined: true });
    expect(combinedViolations.length, formatViolations(combinedViolations)).toBe(0);
  });

  it('reports each person’s spending as what they actually funded, summing to the budget', () => {
    const scenario = couple();
    scenario.householdWithdrawalOrder = ['CA_CASH_POOL', 'CA_NON_REGISTERED', 'CA_RRSP_RRIF', 'CA_TFSA'];
    // Person 2 has a pension, so they fund part of it from income rather than
    // from an account - both routes have to land in the same column.
    scenario.persons[1].incomeSources = [{ id: 'pension', label: 'Pension', startYear, annualAmountNominal: 30_000, growthRatePct: 0 }];

    const rows = buildScenarioLedger(scenario, []).map((l) => l.result.rows[0]);
    expect(rows[0].spendingNominal + rows[1].spendingNominal).toBeCloseTo(100_000, 2);
    expect(rows[1].spendingNominal).toBeGreaterThan(0);
  });

  it('uses the before-retirement budget while nobody has retired, then switches at the first retirement', () => {
    const scenario = couple();
    scenario.householdSpendingRealBeforeRetirement = 40_000;
    scenario.householdSpendingRealAtRetirement = 100_000;
    for (const person of scenario.persons) person.retirementStartYear = null;
    const beforeTotal = buildScenarioLedger(scenario, []).reduce((sum, l) => sum + l.result.rows[0].spendingNominal, 0);
    expect(beforeTotal).toBeCloseTo(40_000, 2);

    scenario.persons[0].retirementStartYear = startYear;
    const afterTotal = buildScenarioLedger(scenario, []).reduce((sum, l) => sum + l.result.rows[0].spendingNominal, 0);
    expect(afterTotal).toBeCloseTo(100_000, 2);
  });

  it('lets a grid override set the household budget for one year', () => {
    const scenario = couple();
    const rows = buildScenarioLedger(scenario, [
      {
        id: 'o1',
        scenarioId: scenario.id,
        personId: scenario.persons[0].id,
        year: startYear,
        field: 'spendingNominal',
        value: 12_345,
        createdAt: new Date().toISOString(),
      },
    ]).map((l) => l.result.rows[0]);

    expect(rows[0].spendingNominal + rows[1].spendingNominal).toBeCloseTo(12_345, 2);
  });
});

describe('spilling between people within a kind', () => {
  /**
   * Two people holding one kind between them, in the balances given, with a
   * roomy non-registered account underneath to spill into. `kind` picks whether
   * the draw is taxable, since a tax-deferred one funds the household's tax
   * bill through the same pass and would confound a ratio measurement.
   */
  function withBalances(kind: 'CA_TFSA' | 'CA_RRSP_RRIF', balances: [number, number], spending: number, backstop = 5_000_000) {
    const scenario = couple();
    scenario.householdWithdrawalOrder = [kind, 'CA_NON_REGISTERED'];
    scenario.householdSpendingRealAtRetirement = spending;
    scenario.persons.forEach((person, i) => {
      for (const bucket of person.accountBuckets) {
        bucket.startingBalance = bucket.kind === kind ? balances[i] : bucket.kind === 'CA_NON_REGISTERED' ? backstop : 0;
      }
    });

    return buildScenarioLedger(scenario, []).map((ledger, i) => {
      const bucket = ledger.plan.accountBuckets.find((b) => b.kind === kind)!;
      const row = ledger.result.rows[0];
      const nonRegistered = ledger.plan.accountBuckets.find((b) => b.kind === 'CA_NON_REGISTERED')!;
      return {
        start: balances[i],
        drawn: row.withdrawals[bucket.id] ?? 0,
        end: row.accountEnd[bucket.id] ?? 0,
        spilled: row.withdrawals[nonRegistered.id] ?? 0,
      };
    });
  }

  it('splits a kind across two people in proportion to what each holds', () => {
    // A tax-free kind, so the figures are the spending draw alone.
    const [a, b] = withBalances('CA_TFSA', [100_000, 900_000], 200_000);

    expect(a.drawn + b.drawn).toBeCloseTo(200_000, 2);
    expect(a.drawn / b.drawn).toBeCloseTo(1 / 9, 4);
  });

  it('never over-draws the smaller account', () => {
    // Structural rather than incidental: each account's share is
    // need × balance ÷ total, which cannot exceed its own balance.
    const [a, b] = withBalances('CA_TFSA', [100_000, 900_000], 200_000);

    expect(a.drawn).toBeLessThanOrEqual(a.start);
    expect(b.drawn).toBeLessThanOrEqual(b.start);
    expect(a.end).toBeGreaterThan(0);
    expect(b.end).toBeGreaterThan(0);
  });

  it('lets whoever still has funds carry the whole kind', () => {
    // One person holds nothing of this kind, so the other covers all of it -
    // this is the case that used to leave an account idle for a whole plan.
    const [a, b] = withBalances('CA_TFSA', [0, 900_000], 200_000);

    expect(a.drawn).toBe(0);
    expect(b.drawn).toBeCloseTo(200_000, 2);
  });

  it('falls through to the next kind once both are exhausted, tax and all', () => {
    // Tax-deferred here, because the interaction is the point: the draw funds
    // the household's tax bill as well as its spending, and both spill.
    const [a, b] = withBalances('CA_RRSP_RRIF', [50_000, 50_000], 300_000);

    expect(a.drawn).toBeCloseTo(50_000, 2);
    expect(b.drawn).toBeCloseTo(50_000, 2);
    expect(a.end).toBeCloseTo(0, 2);
    expect(b.end).toBeCloseTo(0, 2);
    // The remainder, and the tax the RRSP draw generated, come from the next
    // kind in the order rather than shortfalling.
    expect(a.spilled + b.spilled).toBeGreaterThan(200_000);
  });
});
