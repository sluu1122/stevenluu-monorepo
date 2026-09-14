import { describe, expect, it } from 'vitest';
import { calculateTotalTax } from './calculateTax';
import { getDefaultFederalTable } from './taxBrackets';
import { US_STATE_TAX_TABLES } from './regionalTaxTables';
import { buildScenarioLedger } from './ledger';
import { createFundedScenario } from './testFixtures';
import type { Scenario, TaxConfig } from './schema';

const usTx: TaxConfig = {
  country: 'US',
  filingStatus: 'single',
  federalTable: getDefaultFederalTable('US', 'single'),
  stateOrProvincialTable: { ...US_STATE_TAX_TABLES.TX },
};

describe('US long-term capital gains', () => {
  // The headline case the old inclusion-rate model got wrong: a retiree whose
  // total taxable income stays inside the 0% band owes NOTHING on the gain.
  it('taxes a gain at 0% when it lands inside the zero band', () => {
    const withGain = calculateTotalTax(20_000, usTx, 0, 20_000);
    const without = calculateTotalTax(20_000, usTx, 0, 0);
    expect(withGain.total - without.total).toBeCloseTo(0, 2);
  });

  it('taxes a gain at 15% once ordinary income has used up the zero band', () => {
    const ordinary = 120_000;
    const gain = 20_000;
    const delta = calculateTotalTax(ordinary, usTx, 0, gain).total - calculateTotalTax(ordinary, usTx, 0, 0).total;
    expect(delta).toBeCloseTo(gain * 0.15, 2);
  });

  it('splits a gain that straddles the 0% and 15% bands', () => {
    // Taxable income after the 16,100 deduction is 33,900, leaving 15,550 of
    // the zero band; a 30,000 gain therefore pays 15% on 14,450 of itself.
    const delta = calculateTotalTax(50_000, usTx, 0, 30_000).total - calculateTotalTax(50_000, usTx, 0, 0).total;
    expect(delta).toBeCloseTo(14_450 * 0.15, 2);
  });

  // The deduction covers ordinary income first; only what is left reaches the
  // gain. Without that a retiree with almost no ordinary income is taxed on a
  // gain the standard deduction actually absorbs.
  it('lets the unused standard deduction absorb part of the gain', () => {
    // Chosen so the absorption actually CHANGES the bill. With a small gain the
    // whole thing sits in the 0% band either way, so the assertion would pass
    // against an engine that ignored the deduction entirely.
    //
    // Ordinary 5,000 against a 16,100 deduction leaves 11,100 of it spare, so a
    // 80,000 gain is taxed on 68,900: the first 49,450 at 0%, the rest at 15%.
    const delta = calculateTotalTax(5_000, usTx, 0, 80_000).total - calculateTotalTax(5_000, usTx, 0, 0).total;
    expect(delta).toBeCloseTo((68_900 - 49_450) * 0.15, 2);
  });

  it('charges nothing at all when the deduction covers income and gain together', () => {
    expect(calculateTotalTax(5_000, usTx, 0, 8_000).total).toBeCloseTo(0, 2);
  });

  it('is never charged on a Canadian scenario, whose gains are ordinary income', () => {
    const caTx: TaxConfig = { ...usTx, country: 'CA', federalTable: getDefaultFederalTable('CA', 'single') };
    const withGain = calculateTotalTax(60_000, caTx, 0, 25_000);
    const without = calculateTotalTax(60_000, caTx, 0, 0);
    expect(withGain.total).toBeCloseTo(without.total, 6);
  });

  // Preferential federally, ordinary at state level - which is what almost
  // every state that taxes income actually does.
  it('taxes the whole gain at ordinary rates on the state return', () => {
    const ca: TaxConfig = { ...usTx, stateOrProvincialTable: { ...US_STATE_TAX_TABLES.CA } };
    const withGain = calculateTotalTax(120_000, ca, 0, 20_000);
    const without = calculateTotalTax(120_000, ca, 0, 0);
    expect(withGain.stateOrProvincial).toBeGreaterThan(without.stateOrProvincial);
  });
});

describe('the split is per ACCOUNT country, not per scenario', () => {
  /** Forces a large sale out of one taxable account by spending far beyond income. */
  function scenarioSellingTaxable(country: 'US' | 'CA') {
    const scenario = createFundedScenario(country);
    const person = scenario.persons[0];
    person.annualIncomeNominal = 0;
    person.retirementStartYear = person.birthYear;
    person.benefits = [];
    for (const b of person.accountBuckets) b.annualContributionWhileWorking = 0;
    scenario.householdSpendingRealAtRetirement = 90_000;
    return scenario;
  }

  /** Every audit label across the projection - the sale may not land in year one. */
  function auditLabels(scenario: Scenario) {
    return buildScenarioLedger(scenario, [])[0].result.rows.flatMap((row) => row.audit.steps.map((step) => step.label));
  }

  it('reports a US sale as a long-term gain, not as ordinary-income inclusion', () => {
    const labels = auditLabels(scenarioSellingTaxable('US'));
    expect(labels.some((l) => l.includes('Long-term capital gain realized on US taxable accounts'))).toBe(true);
    expect(labels.some((l) => l.includes('(Canada)'))).toBe(false);
  });

  it('reports a Canadian sale as the inclusion-rate gain it is', () => {
    const labels = auditLabels(scenarioSellingTaxable('CA'));
    expect(labels.some((l) => l.includes('(Canada)'))).toBe(true);
    expect(labels.some((l) => l.includes('Long-term capital gain realized on US taxable accounts'))).toBe(false);
  });
});
