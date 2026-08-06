import { describe, expect, it } from 'vitest';
import { CANADIAN_TAX_TABLES, US_STATE_TAX_TABLES, flatRateTable } from './regionalTaxTables';
import { calculateStateOrProvincialTax } from './calculateTax';
import type { StateOrProvincialTaxTable } from './schema';

/** Every bracket's own shape - a well-formed ladder with exactly one open top rung. */
function expectWellFormedBrackets(table: StateOrProvincialTaxTable): void {
  expect(table.brackets.length).toBeGreaterThan(0);
  expect(table.brackets[0].min).toBe(0);
  expect(table.brackets[table.brackets.length - 1].max).toBeNull();
  expect(table.brackets.filter((b) => b.max === null)).toHaveLength(1);

  for (let i = 0; i < table.brackets.length; i++) {
    const bracket = table.brackets[i];
    expect(bracket.rate).toBeGreaterThanOrEqual(0);
    expect(bracket.rate).toBeLessThanOrEqual(1);
    if (bracket.max !== null) expect(bracket.max).toBeGreaterThan(bracket.min);
    // Each bracket picks up exactly where the last one left off - no gap a
    // dollar could fall through, no overlap that double-counts one.
    if (i > 0) expect(bracket.min).toBe(table.brackets[i - 1].max);
  }
}

describe('Canadian tax tables', () => {
  it('seeds exactly the ten provinces and three territories', () => {
    expect(Object.keys(CANADIAN_TAX_TABLES)).toHaveLength(13);
  });

  it('every table has well-formed brackets and a sane credit', () => {
    for (const [key, table] of Object.entries(CANADIAN_TAX_TABLES)) {
      expectWellFormedBrackets(table);
      expect(table.basicPersonalAmount, key).toBeGreaterThan(0);
      expect(table.creditRate, key).toBe(table.brackets[0].rate);
    }
  });

  it('gives Ontario the only surtax among the provinces', () => {
    for (const [key, table] of Object.entries(CANADIAN_TAX_TABLES)) {
      if (key === 'ON') expect(table.surtax.length).toBeGreaterThan(0);
      else expect(table.surtax, key).toHaveLength(0);
    }
  });
});

describe('US state tax tables', () => {
  it('seeds all fifty states', () => {
    expect(Object.keys(US_STATE_TAX_TABLES)).toHaveLength(50);
  });

  it('every table has well-formed brackets', () => {
    for (const table of Object.values(US_STATE_TAX_TABLES)) {
      expectWellFormedBrackets(table);
    }
  });

  it('gives the nine no-income-tax states a single zero-rate bracket', () => {
    for (const key of ['AK', 'FL', 'NV', 'NH', 'SD', 'TN', 'TX', 'WA', 'WY']) {
      const table = US_STATE_TAX_TABLES[key];
      expect(table.brackets).toEqual([{ min: 0, max: null, rate: 0 }]);
      expect(calculateStateOrProvincialTax(500_000, table).tax).toBe(0);
    }
  });

  it('taxes a flat-rate state at exactly rate × (income − standard deduction)', () => {
    // The credit-vs-deduction approximation the rest of the file documents is
    // EXACT for a flat state, since there's only one rate to apply either way.
    // If this ever drifts off that identity, the seeded deduction figures are
    // silently costing (or saving) every flat-state user real money.
    for (const key of ['AZ', 'CO', 'GA', 'ID', 'IL', 'IN', 'IA', 'KY', 'LA', 'MI', 'NC', 'PA', 'UT']) {
      const table = US_STATE_TAX_TABLES[key];
      expect(table.brackets, key).toHaveLength(1);
      const income = 150_000;
      const expected = Math.max(0, income - table.basicPersonalAmount) * table.brackets[0].rate;
      expect(calculateStateOrProvincialTax(income, table).tax, key).toBeCloseTo(expected, 6);
    }
  });
});

describe('every seeded table (Canadian and US)', () => {
  const all = { ...CANADIAN_TAX_TABLES, ...US_STATE_TAX_TABLES };

  it('never charges negative tax and never refunds below zero', () => {
    for (const [key, table] of Object.entries(all)) {
      for (const income of [0, 500, 25_000]) {
        expect(calculateStateOrProvincialTax(income, table).tax, `${key} at ${income}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('is monotonically non-decreasing as income rises, for every table', () => {
    // A progressive system can never tax a higher income LESS than a lower
    // one - if some bracket or the BPA math regressed, this is where it shows.
    const incomes = [0, 10_000, 50_000, 100_000, 250_000, 1_000_000, 5_000_000];
    for (const [key, table] of Object.entries(all)) {
      let previous = -Infinity;
      for (const income of incomes) {
        const tax = calculateStateOrProvincialTax(income, table).tax;
        expect(tax, `${key} at ${income}`).toBeGreaterThanOrEqual(previous);
        previous = tax;
      }
    }
  });

  it('has a label distinct from every other table in the same country group', () => {
    expect(new Set(Object.values(CANADIAN_TAX_TABLES).map((t) => t.label)).size).toBe(13);
    expect(new Set(Object.values(US_STATE_TAX_TABLES).map((t) => t.label)).size).toBe(50);
  });
});

describe('flatRateTable', () => {
  it('reproduces a flat percentage of gross income exactly, with no personal amount', () => {
    const table = flatRateTable(5);
    expect(calculateStateOrProvincialTax(100_000, table).tax).toBeCloseTo(5_000, 6);
    expect(calculateStateOrProvincialTax(0, table).tax).toBe(0);
  });
});
