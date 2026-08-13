import { describe, expect, it } from 'vitest';
import { buildScenarioLedger } from './ledger';
import { calculateStateOrProvincialTax, calculateTotalTax, indexTaxConfig } from './calculateTax';
import { CANADIAN_TAX_TABLES, flatRateTable } from './regionalTaxTables';
import { createDefaultScenario } from './defaults';
import { createDemoScenarios } from './demoScenarios';
import type { AccountBucket, Scenario } from './schema';

const startYear = new Date().getFullYear();

describe('provincial tax table', () => {
  const bc = CANADIAN_TAX_TABLES.BC;

  it('walks brackets progressively rather than charging one rate on everything', () => {
    // 5.06% on the first 49,279, then 7.7% on the rest.
    const expected = 49_279 * 0.0506 + (80_000 - 49_279) * 0.077;
    const credit = bc.basicPersonalAmount * bc.creditRate;

    expect(calculateStateOrProvincialTax(80_000, bc).tax).toBeCloseTo(expected - credit, 6);
  });

  it('grants the basic personal amount as a credit, so it is worth the same at every income', () => {
    // A deduction would be worth 20.5% of the amount to a top-bracket earner
    // and 5.06% to a bottom-bracket one. A credit is worth creditRate to both,
    // which is what the CRA and every province actually do.
    const credit = bc.basicPersonalAmount * bc.creditRate;
    const lowRelief = calculateStateOrProvincialTax(40_000, { ...bc, basicPersonalAmount: 0 }).tax - calculateStateOrProvincialTax(40_000, bc).tax;
    const highRelief = calculateStateOrProvincialTax(400_000, { ...bc, basicPersonalAmount: 0 }).tax - calculateStateOrProvincialTax(400_000, bc).tax;

    expect(lowRelief).toBeCloseTo(credit, 6);
    expect(highRelief).toBeCloseTo(credit, 6);
  });

  it('never refunds: the credit cannot take the bill below zero', () => {
    expect(calculateStateOrProvincialTax(1_000, bc).tax).toBe(0);
    expect(calculateStateOrProvincialTax(0, bc).tax).toBe(0);
  });

  it('charges Ontario’s surtax on the tax rather than on income', () => {
    const on = CANADIAN_TAX_TABLES.ON;
    const withSurtax = calculateStateOrProvincialTax(250_000, on).tax;
    const withoutSurtax = calculateStateOrProvincialTax(250_000, { ...on, surtax: [] }).tax;

    // Both bands bite well before this income, so the two differ by exactly
    // 20% + 36% of the excess over each threshold.
    const expected = on.surtax.reduce((sum, band) => sum + Math.max(0, withoutSurtax - band.taxOver) * band.rate, 0);
    expect(withSurtax - withoutSurtax).toBeCloseTo(expected, 6);
    expect(withSurtax).toBeGreaterThan(withoutSurtax);
  });

  it('charges materially more than the flat 5% it replaced, at a retirement-sized withdrawal', () => {
    // The reason this exists: a flat 5% understated a large registered
    // withdrawal badly, which made an aggressive meltdown look cheap.
    const flat = calculateStateOrProvincialTax(170_000, flatRateTable(5)).tax;
    const real = calculateStateOrProvincialTax(170_000, bc).tax;

    expect(real).toBeGreaterThan(flat * 1.4);
  });

  it('indexes provincial brackets, the personal amount and the surtax thresholds together', () => {
    const config = { ...createDefaultScenario('CA').taxConfig, stateOrProvincialTable: CANADIAN_TAX_TABLES.ON };
    const indexed = indexTaxConfig(config, 2);
    const table = indexed.stateOrProvincialTable;

    expect(table.basicPersonalAmount).toBeCloseTo(CANADIAN_TAX_TABLES.ON.basicPersonalAmount * 2, 6);
    expect(table.brackets[1].min).toBeCloseTo(CANADIAN_TAX_TABLES.ON.brackets[1].min * 2, 6);
    expect(table.brackets[1].rate).toBe(CANADIAN_TAX_TABLES.ON.brackets[1].rate);
    expect(table.surtax[0].taxOver).toBeCloseTo(CANADIAN_TAX_TABLES.ON.surtax[0].taxOver * 2, 6);
    expect(table.surtax[0].rate).toBe(CANADIAN_TAX_TABLES.ON.surtax[0].rate);
  });

  it('reports a combined marginal rate, since a decision faces both tables at once', () => {
    const config = { ...createDefaultScenario('CA').taxConfig, stateOrProvincialTable: CANADIAN_TAX_TABLES.BC };
    const result = calculateTotalTax(300_000, config);
    // Top CA federal bracket (33%) plus BC's top (20.5%).
    expect(result.marginalRatePct).toBeCloseTo(33 + 20.5, 6);
  });
});

describe('non-registered account taxation', () => {
  /** One retiree, one non-registered account, nothing else moving. */
  function taxableOnly(options: { balance?: number; costBasis?: number; returnPct?: number; spending?: number } = {}) {
    const scenario = createDefaultScenario('CA');
    scenario.inflation = { mode: 'flat', flatRatePct: 0 };
    scenario.returnRates = {
      investmentsPreRetirementPct: options.returnPct ?? 0,
      investmentsPostRetirementPct: options.returnPct ?? 0,
      cashPct: 0,
    };

    const person = scenario.persons[0];
    person.retirementStartYear = startYear;
    person.planningEndAge = startYear - person.birthYear;
    person.annualIncomeNominal = 0;
    person.benefits = [];
    person.meltdownRules = [];
    person.cashBufferRule = { enabled: false, targetMonthsOfSpending: 6, replenishmentOrder: [] };
    person.requiredDistributionRule = { enabled: false, startAgeOverride: null, destinationAccountBucketId: null };

    const account: AccountBucket = {
      id: 'nonreg',
      label: 'Non-Registered',
      country: 'CA',
      kind: 'CA_NON_REGISTERED',
      taxTreatment: 'taxable',
      startingBalance: options.balance ?? 1_000_000,
      costBasis: options.costBasis,
    };
    person.accountBuckets = [account];
    scenario.householdWithdrawalOrder = ['CA_NON_REGISTERED'];
    scenario.householdSpendingRealAtRetirement = options.spending ?? 0;

    return { scenario, person, account };
  }

  const rowFor = (scenario: Scenario) => buildScenarioLedger(scenario, [])[0].result.rows[0];

  it('taxes the distribution yield every year even when nothing is sold', () => {
    // The gap that mattered most: a taxable brokerage used to compound
    // completely untaxed for the whole projection.
    const { scenario } = taxableOnly({ balance: 1_000_000 });
    const row = rowFor(scenario);

    // 2% of a million is 20,000 of ordinary income, with no spending at all.
    expect(row.taxesPaid.total).toBeCloseTo(calculateTotalTax(20_000, scenario.taxConfig).total, 2);
    // The distribution is reinvested rather than paid out, so the bill it
    // creates has to be funded by selling - the only sale of the year, and
    // exactly the size of the tax.
    expect(row.withdrawals['nonreg']).toBeCloseTo(row.taxesPaid.total, 2);
  });

  it('charges nothing at all when the feature is switched off - distributions AND gains', () => {
    // Both halves have to go quiet. Gating only the distribution would leave
    // an embedded gain being taxed on every sale, which is not what "off"
    // means and would silently re-introduce most of the effect.
    const { scenario } = taxableOnly({ balance: 1_000_000, costBasis: 100_000, spending: 200_000 });
    scenario.taxableAccountTaxation = { ...scenario.taxableAccountTaxation, enabled: false };
    const row = rowFor(scenario);

    expect(row.taxesPaid.total).toBe(0);
    expect(row.withdrawals['nonreg']).toBeCloseTo(200_000, 2);
  });

  it('taxes only the included portion of a realized gain, in proportion to what was sold', () => {
    // Half the account is embedded gain, so selling 100,000 realizes 50,000 of
    // gain, of which 50% is included: 25,000 of taxable income. Distributions
    // are switched off here so the gain is the only thing under test.
    const { scenario } = taxableOnly({ balance: 1_000_000, costBasis: 500_000, spending: 100_000 });
    scenario.taxableAccountTaxation = { ...scenario.taxableAccountTaxation, annualDistributionYieldPct: 0 };
    const row = rowFor(scenario);

    // 100,000 sold to fund spending realizes 50,000 of gain, half of which is
    // included: 25,000 of taxable income.
    expect(row.taxesPaid.total).toBeCloseTo(calculateTotalTax(100_000 * 0.5 * 0.5, scenario.taxConfig).total, 2);
    // More than 100,000 leaves the account, because the tax bill is funded out
    // of it too. That extra sale's own gain goes uncharged - the same
    // approximation the engine already makes for the tax draw generally.
    expect(row.withdrawals['nonreg']).toBeGreaterThan(100_000);
  });

  it('realizes no gain when the cost basis equals the balance', () => {
    const { scenario } = taxableOnly({ balance: 1_000_000, spending: 100_000 });
    scenario.taxableAccountTaxation = { ...scenario.taxableAccountTaxation, annualDistributionYieldPct: 0 };
    const row = rowFor(scenario);

    expect(row.withdrawals['nonreg']).toBeCloseTo(100_000, 2);
    expect(row.taxesPaid.total).toBe(0);
  });

  it('defaults an unstated cost basis to the starting balance, so nothing is invented', () => {
    const stated = taxableOnly({ balance: 1_000_000, costBasis: 1_000_000, spending: 100_000 });
    const unstated = taxableOnly({ balance: 1_000_000, spending: 100_000 });

    expect(rowFor(unstated.scenario).taxesPaid.total).toBeCloseTo(rowFor(stated.scenario).taxesPaid.total, 6);
  });

  it('a low cost basis costs materially more to draw down than a high one', () => {
    const low = taxableOnly({ balance: 1_000_000, costBasis: 100_000, spending: 100_000 });
    const high = taxableOnly({ balance: 1_000_000, costBasis: 900_000, spending: 100_000 });

    expect(rowFor(low.scenario).taxesPaid.total).toBeGreaterThan(rowFor(high.scenario).taxesPaid.total * 2);
  });

  it('does not tax a reinvested distribution twice - once as income, again as gain', () => {
    // The distribution raises the cost basis by exactly what it added, so the
    // units it bought carry no gain when they are later sold. Without that,
    // every dollar of yield would be taxed as income now and as a capital gain
    // later. Two years: year one distributes, year two sells everything.
    const { scenario, person } = taxableOnly({ balance: 1_000_000, returnPct: 2 });
    person.planningEndAge = startYear - person.birthYear + 1;
    const rows = buildScenarioLedger(scenario, [])[0].result.rows;

    // Year one: 2% return, all of it distributed, nothing sold.
    expect(rows[0].taxesPaid.total).toBeCloseTo(calculateTotalTax(20_000, scenario.taxConfig).total, 2);
    // Year two's basis has absorbed year one's distribution, so the account is
    // still all basis and no gain: the second year's bill is 2% of whatever it
    // opens at and nothing more. Read the opening balance rather than assuming
    // it, since year one sold a little to pay its own tax.
    const openingYearTwo = rows[1].accountStart['nonreg'];
    expect(rows[1].taxesPaid.total).toBeCloseTo(calculateTotalTax(openingYearTwo * 0.02, scenario.taxConfig).total, 2);
  });

  it('treats a cash account as distributing its entire return, since all of it is interest', () => {
    const { scenario, person } = taxableOnly({ balance: 0 });
    scenario.returnRates = { ...scenario.returnRates, cashPct: 3 };
    person.accountBuckets = [
      { id: 'cash', label: 'Cash', country: 'CA', kind: 'CA_CASH_POOL', taxTreatment: 'taxable', startingBalance: 500_000, isCashBuffer: true },
    ];
    scenario.householdWithdrawalOrder = ['CA_CASH_POOL'];

    // 3% of 500,000 - the whole return, not the 2% investment yield.
    expect(rowFor(scenario).taxesPaid.total).toBeCloseTo(calculateTotalTax(15_000, scenario.taxConfig).total, 2);
  });

  it('gives money credited DURING the year its cost basis before the gain is charged', () => {
    // Regression: a taxable account can be drawn down by far more than it
    // opened with, because required distributions and cash-buffer top-ups land
    // in it earlier the same year. Those credits arrive at par and carry basis
    // equal to themselves. Adding that basis only at year end left the gain
    // pass measuring the whole year's sales against the OPENING balance, so
    // everything above it looked like pure appreciation - and a CASH account,
    // which cannot appreciate at all, was charged capital gains tax on
    // required-distribution proceeds already taxed in full as ordinary income.
    const { scenario, person } = taxableOnly({ balance: 0 });
    scenario.returnRates = { investmentsPreRetirementPct: 0, investmentsPostRetirementPct: 0, cashPct: 2 };
    scenario.householdSpendingRealAtRetirement = 150_000;
    scenario.householdWithdrawalOrder = ['CA_CASH_POOL'];

    const cash: AccountBucket = {
      id: 'cash',
      label: 'Cash',
      country: 'CA',
      kind: 'CA_CASH_POOL',
      taxTreatment: 'taxable',
      // Deliberately tiny next to the year's flows, so the sale dwarfs it.
      startingBalance: 20_000,
      isCashBuffer: true,
    };
    const rrsp: AccountBucket = {
      id: 'rrsp',
      label: 'RRSP',
      country: 'CA',
      kind: 'CA_RRSP_RRIF',
      taxTreatment: 'taxDeferred',
      startingBalance: 3_000_000,
    };
    person.accountBuckets = [cash, rrsp];
    person.meltdownRules = [];
    // A REQUIRED distribution, not a meltdown: statutory minimums run in phase
    // 1, before spending draws, which is what lets the year's sales exceed the
    // account's opening balance. A meltdown lands too late to reproduce this.
    person.birthYear = startYear - 75;
    person.planningEndAge = 75;
    person.requiredDistributionRule = { enabled: true, startAgeOverride: null, destinationAccountBucketId: 'cash' };
    person.surplusDestinationAccountBucketId = 'cash';

    const row = rowFor(scenario);
    const sold = row.withdrawals['cash'] ?? 0;
    const credited = row.contributions['cash'] ?? 0;

    // The setup has to actually exercise the bug: more sold than the account
    // opened with, funded by money credited mid-year.
    expect(credited).toBeGreaterThan(20_000);
    expect(sold).toBeGreaterThan(20_000);

    const gainStep = row.audit.steps.find((s) => s.label.includes('capital gain'));
    expect(gainStep?.result ?? 0).toBe(0);
  });
});

describe('OAS clawback base', () => {
  it('counts a meltdown withdrawal against the following year’s clawback', () => {
    // A meltdown deliberately generates a large taxable income, so it is
    // exactly what the clawback tests against. The assignment used to happen
    // before meltdowns ran, so this income was invisible to it.
    const scenario = createDefaultScenario('CA');
    scenario.inflation = { mode: 'flat', flatRatePct: 0 };
    scenario.returnRates = { investmentsPreRetirementPct: 0, investmentsPostRetirementPct: 0, cashPct: 0 };
    scenario.taxableAccountTaxation = { ...scenario.taxableAccountTaxation, enabled: false };
    scenario.householdSpendingRealAtRetirement = 0;

    const person = scenario.persons[0];
    person.birthYear = startYear - 65;
    person.retirementStartYear = startYear;
    person.planningEndAge = 67;
    person.annualIncomeNominal = 0;
    person.cashBufferRule = { enabled: false, targetMonthsOfSpending: 6, replenishmentOrder: [] };
    person.requiredDistributionRule = { enabled: false, startAgeOverride: null, destinationAccountBucketId: null };
    person.benefits = [{ type: 'CA_OAS', claimAge: 65, monthlyBenefitAtClaimAge: 750, colaPct: 0 }];

    const rrsp = person.accountBuckets.find((b) => b.kind === 'CA_RRSP_RRIF')!;
    const tfsa = person.accountBuckets.find((b) => b.kind === 'CA_TFSA')!;
    rrsp.startingBalance = 2_000_000;
    for (const b of person.accountBuckets) b.annualContributionWhileWorking = 0;

    const withMeltdown = structuredClone(scenario);
    withMeltdown.persons[0].meltdownRules = [
      // Far above the ~93k clawback threshold, so the year after it runs the
      // benefit should be clawed back in full.
      { accountBucketId: rrsp.id, enabled: true, targetTaxableIncomeCeiling: 300_000, startYear, endYear: null, destinationAccountBucketId: tfsa.id },
    ];
    scenario.persons[0].meltdownRules = [];

    const oasOf = (s: Scenario, index: number) =>
      buildScenarioLedger(s, [])[0].result.rows[index].benefits.filter((b) => b.type === 'CA_OAS').reduce((sum, b) => sum + b.amount, 0);

    // Year one is unaffected either way - the clawback keys off the PRIOR year,
    // and there is no prior year in the projection.
    expect(oasOf(withMeltdown, 0)).toBeCloseTo(oasOf(scenario, 0), 6);
    // Year two is where it bites.
    expect(oasOf(scenario, 1)).toBeGreaterThan(0);
    expect(oasOf(withMeltdown, 1)).toBe(0);
  });
});

describe('cash buffer interest', () => {
  // Phase 0b taxes a cash buffer's interest as ordinary income and credits the
  // same amount to cost basis, computed on the balance the account OPENED the
  // year with. Phase 3 used to apply growth to the POST-FLOW balance instead,
  // so in a year where the buffer was topped up, the difference landed in the
  // account having been taxed as nothing - and then surfaced as a capital gain
  // the next time cash was sold. That is the "gain on a cash-only-sale year"
  // residual from the original household audit.
  //
  // Asserted against the demo scenarios because that is where it was seen: a
  // buffer refilled toward six months of spending every year makes the two
  // balances differ by a lot, which is what made the residual visible.
  it.each(createDemoScenarios().map((s) => [s.name, s] as const))('is earned on the opening balance, so it equals what was taxed: %s', (_name, scenario) => {
    const cashRate = scenario.returnRates.cashPct / 100;

    for (const { plan, result } of buildScenarioLedger(scenario, [])) {
      const cashBuckets = [...plan.accountBuckets, ...scenario.sharedAccountBuckets].filter((b) => b.isCashBuffer);
      expect(cashBuckets.length, `${plan.id} has no cash buffer to check`).toBeGreaterThan(0);

      for (const row of result.rows) {
        for (const bucket of cashBuckets) {
          const opening = Math.max(0, row.accountStart[bucket.id] ?? 0);
          expect(row.growth[bucket.id] ?? 0, `${bucket.label} in ${row.year}`).toBeCloseTo(opening * cashRate, 6);
        }
      }
    }
  });

  it('leaves a buffer that opened the year empty earning nothing, however much it later receives', () => {
    // The sharpest version of the same bug: the cross-border scenario's
    // non-earning spouse opens with no cash at all, so under the old rule
    // every dollar of that first year's interest was untaxed and unbasised.
    const scenario = createDemoScenarios().find((s) => s.persons.length > 1 && s.persons.some((p) => p.accountBuckets.some((b) => b.isCashBuffer && b.startingBalance === 0)))!;
    const ledgers = buildScenarioLedger(scenario, []);

    const emptyStart = ledgers.flatMap(({ plan, result }) =>
      plan.accountBuckets.filter((b) => b.isCashBuffer && b.startingBalance === 0).map((bucket) => ({ bucket, first: result.rows[0] })),
    );
    expect(emptyStart.length, 'no empty-opening cash buffer in the demos').toBeGreaterThan(0);

    for (const { bucket, first } of emptyStart) {
      expect(first.accountStart[bucket.id] ?? 0).toBe(0);
      expect(first.growth[bucket.id] ?? 0, `${bucket.label} grew despite opening empty`).toBe(0);
    }
  });
});
