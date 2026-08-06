import { describe, expect, it } from 'vitest';
import { calculateFederalTax, calculateTotalTax } from './calculateTax';
import { US_FEDERAL_2026_SINGLE, CA_FEDERAL_2026 } from './taxBrackets';
import type { TaxConfig } from './schema';
import { flatRateTable } from './provincialTaxTables';

describe('calculateFederalTax', () => {
  it('owes nothing when income is below the standard deduction', () => {
    const result = calculateFederalTax(10_000, US_FEDERAL_2026_SINGLE);
    expect(result.tax).toBe(0);
  });

  it('taxes only the amount above the standard deduction at the first bracket', () => {
    // taxable income = 20,000 - 16,100 = 3,900, all in the 10% bracket
    const result = calculateFederalTax(20_000, US_FEDERAL_2026_SINGLE);
    expect(result.tax).toBeCloseTo(390, 5);
    expect(result.marginalRatePct).toBe(10);
  });

  it('walks multiple brackets progressively, not flatly at the marginal rate', () => {
    // taxable income = 100,000 - 16,100 = 83,900
    // 10%: 11,925 * 0.10 = 1,192.5
    // 12%: (48,475-11,925) * 0.12 = 4,386
    // 22%: (83,900-48,475) * 0.22 = 7,793.5
    const result = calculateFederalTax(100_000, US_FEDERAL_2026_SINGLE);
    expect(result.tax).toBeCloseTo(1_192.5 + 4_386 + 7_793.5, 5);
    expect(result.marginalRatePct).toBe(22);
  });

  it('taxes the top bracket with no upper bound', () => {
    const result = calculateFederalTax(1_000_000, US_FEDERAL_2026_SINGLE);
    expect(result.marginalRatePct).toBe(37);
    expect(result.tax).toBeGreaterThan(0);
  });

  it('applies Canada federal brackets independently of the US table', () => {
    // taxable income = 50,000 - 16,452 = 33,548, all in the 14% bracket
    const result = calculateFederalTax(50_000, CA_FEDERAL_2026);
    expect(result.tax).toBeCloseTo(33_548 * 0.14, 5);
  });
});

describe('calculateTotalTax', () => {
  const taxConfig: TaxConfig = {
    country: 'US',
    filingStatus: 'single',
    federalTable: US_FEDERAL_2026_SINGLE,
    // A single 5% bracket with no personal amount - the shape a pre-v8
    // scenario migrates into, which is what makes the old assertions still
    // meaningful here.
    stateOrProvincialTable: flatRateTable(5),
  };

  it('adds the state/provincial table on top of the federal bracket tax', () => {
    const result = calculateTotalTax(100_000, taxConfig);
    expect(result.stateOrProvincial).toBeCloseTo(5_000, 5);
    expect(result.total).toBeCloseTo(result.federal + 5_000, 5);
  });

  it('reduces to just federal tax when the state/provincial table is all zeroes', () => {
    const result = calculateTotalTax(100_000, { ...taxConfig, stateOrProvincialTable: flatRateTable(0) });
    expect(result.stateOrProvincial).toBe(0);
    expect(result.total).toBe(result.federal);
  });
});
