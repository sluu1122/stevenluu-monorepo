import { describe, expect, it } from 'vitest';
import { buildScenarioLedger } from './ledger';
import { combineLedgers } from './combineLedgers';
import { createDefaultPersonPlan, createDefaultScenario } from './defaults';
import { convertBucketAmountToScenarioCurrency } from './currency';
import { checkLedgerInvariants, formatViolations } from './invariants';
import type { AccountBucket, Scenario } from './schema';

/**
 * Runs the balance-sheet invariant checker over every person's view of a
 * scenario plus the combined household view, and fails with the offending
 * year/account/numbers rather than a bare boolean.
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

function retireEveryoneNow(scenario: Scenario, spending: number) {
  const startYear = new Date().getFullYear();
  for (const person of scenario.persons) {
    person.retirementStartYear = startYear;
    scenario.householdSpendingRealAtRetirement = spending;
    person.planningEndAge = startYear - person.birthYear + 12;
  }
  return startYear;
}

describe('balance-sheet invariants', () => {
  it('holds for a default single-person US scenario', () => {
    expectNoViolations(createDefaultScenario('US'));
  });

  it('holds for a default single-person CA scenario', () => {
    expectNoViolations(createDefaultScenario('CA'));
  });

  it('holds while a retired person is actively drawing down', () => {
    const scenario = createDefaultScenario('CA');
    retireEveryoneNow(scenario, 90_000);
    expectNoViolations(scenario);
  });

  it('holds for two persons sharing a household cash buffer', () => {
    const scenario = createDefaultScenario('CA');
    const jointCash: AccountBucket = {
      id: 'joint-cash',
      label: 'Joint Cash',
      country: 'CA',
      kind: 'CA_CASH_POOL',
      taxTreatment: 'taxable',
      startingBalance: 15_000,
      isCashBuffer: true,
    };
    scenario.sharedAccountBuckets = [jointCash];
    scenario.sharedCashBufferRule = { enabled: true, targetAccountBucketId: jointCash.id, targetMonthsOfSpending: 12 };
    scenario.persons.push(createDefaultPersonPlan('CA', 'Person 2'));

    retireEveryoneNow(scenario, 55_000);
    for (const person of scenario.persons) {
      // Everyone reaches the joint buffer first, so replenishment and two
      // people's spending all contend for the same pot in the same year.
      person.cashBufferRule.replenishmentOrder = person.accountBuckets.map((b) => b.id);
    }
    expectNoViolations(scenario);
  });

  it('holds when a meltdown is drawing down a tax-deferred account', () => {
    const scenario = createDefaultScenario('CA');
    const startYear = retireEveryoneNow(scenario, 60_000);
    const person = scenario.persons[0];
    const rrsp = person.accountBuckets.find((b) => b.taxTreatment === 'taxDeferred')!;
    const destination = person.accountBuckets.find((b) => b.taxTreatment === 'taxFree')!;
    person.meltdownRules = [
      {
        accountBucketId: rrsp.id,
        enabled: true,
        targetTaxableIncomeCeiling: 90_000,
        startYear,
        endYear: startYear + 8,
        destinationAccountBucketId: destination.id,
      },
    ];

    // Guard against the check passing simply because no meltdown ever fired.
    const rows = buildScenarioLedger(scenario, [])[0].result.rows;
    expect(rows.some((r) => r.meltdownWithdrawalTotal > 0)).toBe(true);

    expectNoViolations(scenario);
  });

  it('holds when a meltdown and a cash-buffer top-up run in the same year', () => {
    // The two interact: the top-up is sourced from the melting-down account,
    // and both feed the same tax bracket - so this is where a dollar is most
    // likely to be double-counted or dropped.
    const scenario = createDefaultScenario('CA');
    const startYear = retireEveryoneNow(scenario, 60_000);
    const person = scenario.persons[0];
    const rrsp = person.accountBuckets.find((b) => b.taxTreatment === 'taxDeferred')!;
    const cash = person.accountBuckets.find((b) => b.isCashBuffer)!;

    cash.startingBalance = 0;
    person.cashBufferRule = {
      enabled: true,
      targetMonthsOfSpending: 12,
      replenishmentOrder: person.accountBuckets.filter((b) => !b.isCashBuffer).map((b) => b.id),
    };
    person.meltdownRules = [
      {
        accountBucketId: rrsp.id,
        enabled: true,
        targetTaxableIncomeCeiling: 90_000,
        startYear,
        endYear: startYear + 8,
        // Deliberately unset, so the destination fallback is exercised too.
        destinationAccountBucketId: null,
      },
    ];

    const rows = buildScenarioLedger(scenario, [])[0].result.rows;
    expect(rows.some((r) => r.meltdownWithdrawalTotal > 0 && r.cashBufferReplenishment > 0)).toBe(true);

    expectNoViolations(scenario);
  });

  it('holds once statutory minimum distributions are forcing money out', () => {
    // The forced withdrawal is split between the cash buffer and a
    // reinvestment account and taxed on the way - three places a dollar
    // could go missing.
    const scenario = createDefaultScenario('CA');
    const startYear = new Date().getFullYear();
    const person = scenario.persons[0];
    person.birthYear = startYear - 80;
    person.planningEndAge = 90;
    person.retirementStartYear = startYear;
    scenario.householdSpendingRealAtRetirement = 50_000;

    const rows = buildScenarioLedger(scenario, [])[0].result.rows;
    expect(rows.some((r) => r.requiredDistributionTotal > 0)).toBe(true);

    expectNoViolations(scenario);
  });

  it('keeps every account in one currency across the horizon when USD and CAD are mixed', () => {
    // The regression that motivated this: a US-domiciled account's End was
    // reported in CAD while its Start carried the raw USD figure, so the
    // account appeared to gain the exchange rate every single year.
    const scenario = createDefaultScenario('CA');
    expect(scenario.currency).toBe('CAD');
    expect(scenario.exchangeRateUsdToCad).toBeGreaterThan(1);

    const person1 = scenario.persons[0];
    const person2 = createDefaultPersonPlan('CA', 'Person 2');
    scenario.persons.push(person2);

    const usBrokerage: AccountBucket = {
      id: 'us-brokerage',
      label: 'Taxable Brokerage',
      country: 'US',
      kind: 'US_TAXABLE_BROKERAGE',
      taxTreatment: 'taxable',
      startingBalance: 150_000,
    };
    // Flat 7% either side of retirement, so the growth assertion below has one
    // rate to check against no matter which half of the projection it lands in.
    scenario.returnRates = { investmentsPreRetirementPct: 7, investmentsPostRetirementPct: 7, cashPreRetirementPct: 7, cashPostRetirementPct: 7 };
    // Owned by person 1 only - in the combined view person 2's row must not
    // report this bucket at all, which is what stopped an unconverted copy
    // from overwriting the owner's converted one.
    person1.accountBuckets = [...person1.accountBuckets, usBrokerage];

    retireEveryoneNow(scenario, 50_000);
    expectNoViolations(scenario);

    const ledgers = buildScenarioLedger(scenario, []);
    const owner = ledgers.find((l) => l.plan.id === person1.id)!.result;
    const other = ledgers.find((l) => l.plan.id === person2.id)!.result;

    // Year one opens at the converted starting balance, not the raw USD figure.
    const openingInCad = convertBucketAmountToScenarioCurrency(usBrokerage.startingBalance, usBrokerage, scenario);
    expect(openingInCad).toBeCloseTo(150_000 * scenario.exchangeRateUsdToCad, 5);
    expect(owner.rows[0].accountStart[usBrokerage.id]).toBeCloseTo(openingInCad, 5);

    // A year with no withdrawal grows by the return rate alone - not by the
    // return rate times the exchange rate.
    const untouched = owner.rows.find((r) => (r.withdrawals[usBrokerage.id] ?? 0) === 0 && (r.contributions[usBrokerage.id] ?? 0) === 0);
    expect(untouched).toBeDefined();
    expect(untouched!.accountEnd[usBrokerage.id]).toBeCloseTo(untouched!.accountStart[usBrokerage.id] * 1.07, 4);

    // The non-owner's row never mentions someone else's account.
    expect(other.rows[0].accountStart[usBrokerage.id]).toBeUndefined();
    expect(other.rows[0].accountEnd[usBrokerage.id]).toBeUndefined();
  });

  it('reports cash-buffer replenishment as an executed transfer, not a policy target', () => {
    // Every dollar the row claims was replenished must be matched by a
    // contribution actually credited to the buffer that year.
    const scenario = createDefaultScenario('CA');
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
    scenario.sharedCashBufferRule = { enabled: true, targetAccountBucketId: jointCash.id, targetMonthsOfSpending: 6 };
    scenario.persons.push(createDefaultPersonPlan('CA', 'Person 2'));
    retireEveryoneNow(scenario, 40_000);
    for (const person of scenario.persons) {
      person.cashBufferRule.replenishmentOrder = person.accountBuckets.map((b) => b.id);
    }

    const ledgers = buildScenarioLedger(scenario, []);
    let yearsWithReplenishment = 0;

    for (const ledger of ledgers) {
      for (const row of ledger.result.rows) {
        const credited = row.contributions[jointCash.id] ?? 0;
        expect(row.cashBufferReplenishment).toBeCloseTo(credited, 2);
        if (row.cashBufferReplenishment > 0.01) {
          yearsWithReplenishment++;
          // Funded, not conjured: something had to be withdrawn to pay for it.
          const withdrawnElsewhere = Object.entries(row.withdrawals)
            .filter(([id]) => id !== jointCash.id)
            .reduce((sum, [, amount]) => sum + amount, 0);
          expect(withdrawnElsewhere).toBeGreaterThan(0);
        }
      }
    }
    expect(yearsWithReplenishment).toBeGreaterThan(0);
  });

  it('surfaces a shortfall as a warning rather than overdrawing an account', () => {
    // Spending far beyond the plan's means: the engine must report it, and
    // must not emit a withdrawal larger than the account can fund.
    const scenario = createDefaultScenario('CA');
    const startYear = retireEveryoneNow(scenario, 400_000);
    const person = scenario.persons[0];
    person.benefits = [];
    person.planningEndAge = startYear - person.birthYear + 5;
    person.cashBufferRule = { ...person.cashBufferRule, enabled: false };

    const ledger = buildScenarioLedger(scenario, [])[0].result;
    expect(ledger.warnings.length).toBeGreaterThan(0);

    const buckets = person.accountBuckets;
    const violations = checkLedgerInvariants({
      rows: ledger.rows,
      buckets,
      openingBalances: Object.fromEntries(buckets.map((b) => [b.id, convertBucketAmountToScenarioCurrency(b.startingBalance, b, scenario)])),
    });
    expect(violations.length, formatViolations(violations)).toBe(0);
  });
});
