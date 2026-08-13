import { describe, expect, it } from 'vitest';
import { calculateFederalTax, calculateStateOrProvincialTax, calculateTotalTax, taxableSocialSecurity } from './calculateTax';
import { US_FEDERAL_2026_SINGLE, US_FEDERAL_2026_MFJ, CA_FEDERAL_2026 } from './taxBrackets';
import type { TaxConfig } from './schema';
import { flatRateTable, US_STATE_TAX_TABLES } from './regionalTaxTables';

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
    // 10%: 12,400 * 0.10 = 1,240
    // 12%: (50,400-12,400) * 0.12 = 4,560
    // 22%: (83,900-50,400) * 0.22 = 7,370
    const result = calculateFederalTax(100_000, US_FEDERAL_2026_SINGLE);
    expect(result.tax).toBeCloseTo(1_240 + 4_560 + 7_370, 5);
    expect(result.marginalRatePct).toBe(22);
  });

  it('taxes the top bracket with no upper bound', () => {
    const result = calculateFederalTax(1_000_000, US_FEDERAL_2026_SINGLE);
    expect(result.marginalRatePct).toBe(37);
    expect(result.tax).toBeGreaterThan(0);
  });

  it('applies Canada federal brackets independently of the US table', () => {
    // taxable income = 50,000 - 16,452 = 33,548, all in the 14% bracket.
    // Deducting the BPA and crediting it at the lowest rate give the same
    // answer here, because the taxpayer's marginal rate IS the lowest rate -
    // which is why this case alone cannot tell the two treatments apart.
    const result = calculateFederalTax(50_000, CA_FEDERAL_2026);
    expect(result.tax).toBeCloseTo(33_548 * 0.14, 5);
  });

  it("values Canada's BPA at the lowest rate, so it is worth the same at every income", () => {
    // The CRA gives the Basic Personal Amount as a non-refundable credit, not a
    // deduction. Deducting it instead - which this used to do - relieved a
    // top-bracket Canadian at 33% on an amount only ever relieved at 14%,
    // understating federal tax by about 3,100 a year. Mirrors the provincial
    // test, which has always asserted this correctly.
    const reliefAt = (income: number) =>
      calculateFederalTax(income, { ...CA_FEDERAL_2026, standardDeductionOrBPA: 0 }).tax - calculateFederalTax(income, CA_FEDERAL_2026).tax;

    const expected = 16_452 * 0.14;
    expect(reliefAt(50_000), 'lowest bracket').toBeCloseTo(expected, 6);
    expect(reliefAt(150_000), 'middle bracket').toBeCloseTo(expected, 6);
    expect(reliefAt(300_000), 'top bracket').toBeCloseTo(expected, 6);
  });

  it("keeps the US standard deduction a deduction, worth the taxpayer's marginal rate", () => {
    // The counterpart to the case above: these two are genuinely different
    // instruments, and the US one must NOT be turned into a credit to match.
    // At 100,000 the deduction sits entirely inside the 22% bracket.
    const relief =
      calculateFederalTax(100_000, { ...US_FEDERAL_2026_SINGLE, standardDeductionOrBPA: 0 }).tax - calculateFederalTax(100_000, US_FEDERAL_2026_SINGLE).tax;

    expect(relief).toBeCloseTo(16_100 * 0.22, 6);
  });

  it('does not simply double the single brackets for married filing jointly', () => {
    // True for the first six brackets and false for the last: the MFJ 37%
    // bracket starts at 768,700, not twice the single filer's 640,600. Deriving
    // the table by doubling taxed that whole band at 35%.
    const single = US_FEDERAL_2026_SINGLE.brackets;
    const mfj = US_FEDERAL_2026_MFJ.brackets;

    for (let i = 0; i < single.length - 1; i++) {
      expect(mfj[i].min, `bracket ${i} min`).toBeCloseTo(single[i].min * 2, 6);
    }

    const topSingle = single[single.length - 1];
    const topMfj = mfj[mfj.length - 1];
    expect(topMfj.rate).toBe(0.37);
    expect(topMfj.min).toBe(768_700);
    expect(topMfj.min, 'the top bracket is NOT doubled').toBeLessThan(topSingle.min * 2);
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

  it('taxes Social Security at 100% inclusion when no benefit amount is passed - the pre-fix behavior', () => {
    const withoutFlag = calculateTotalTax(50_000, taxConfig);
    const withZeroBenefit = calculateTotalTax(50_000, taxConfig, 0);
    expect(withZeroBenefit).toEqual(withoutFlag);
  });

  it('owes no federal tax on a Social Security benefit when combined income is below the provisional-income floor', () => {
    // otherIncome = 2,000; combined = 2,000 + 0.5*20,000 = 12,000, under 25,000.
    const result = calculateTotalTax(22_000, taxConfig, 20_000);
    expect(result.federal).toBe(0);
  });

  it('taxes only the IRS-correct slice of Social Security, not the full benefit, once combined income clears the floor', () => {
    // otherIncome = 40,000, benefit = 26,400 -> combined = 40,000 + 13,200 = 53,200, above the 34,000 second threshold.
    // taxableSS = min(0.85*26,400, 0.85*(53,200-34,000) + min(6,000, 0.5*26,400)) = min(22,440, 16,320+6,000=22,320) = 22,320
    const grossIncome = 40_000 + 26_400;
    const result = calculateTotalTax(grossIncome, taxConfig, 26_400);
    const expectedFederal = calculateFederalTax(40_000 + 22_320, taxConfig.federalTable).tax;
    expect(result.federal).toBeCloseTo(expectedFederal, 5);
    // Charging the full benefit instead would owe strictly more.
    expect(result.federal).toBeLessThan(calculateFederalTax(grossIncome, taxConfig.federalTable).tax);
  });

  it('excludes Social Security from state tax entirely when the state table says it does not tax it', () => {
    const result = calculateTotalTax(66_400, taxConfig, 26_400); // taxConfig's flatRateTable(5) has taxesSocialSecurity: false
    expect(result.stateOrProvincial).toBeCloseTo(40_000 * 0.05, 5);
  });

  it('includes the federally-taxable slice of Social Security in state tax when the state does tax it', () => {
    const taxingState = { ...taxConfig, stateOrProvincialTable: US_STATE_TAX_TABLES.CO }; // Colorado: flat 4.4%, taxesSocialSecurity: true
    expect(taxingState.stateOrProvincialTable.taxesSocialSecurity).toBe(true);
    const otherIncome = 40_000;
    const benefit = 26_400;
    const combined = otherIncome + 0.5 * benefit;
    const expectedSsTaxable = Math.min(0.85 * benefit, 0.85 * (combined - 34_000) + Math.min(6_000, 0.5 * benefit));
    const result = calculateTotalTax(otherIncome + benefit, taxingState, benefit);
    const expectedState = calculateStateOrProvincialTax(otherIncome + expectedSsTaxable, taxingState.stateOrProvincialTable).tax;
    expect(result.stateOrProvincial).toBeCloseTo(expectedState, 5);
    // Charging the full benefit instead would owe strictly more.
    expect(result.stateOrProvincial).toBeLessThan(calculateStateOrProvincialTax(otherIncome + benefit, taxingState.stateOrProvincialTable).tax);
  });

  it('leaves a non-US scenario untouched by a nonzero socialSecurityBenefit argument', () => {
    const caConfig: TaxConfig = { ...taxConfig, country: 'CA', federalTable: CA_FEDERAL_2026 };
    const withBenefit = calculateTotalTax(80_000, caConfig, 26_400);
    const withoutBenefit = calculateTotalTax(80_000, caConfig, 0);
    expect(withBenefit).toEqual(withoutBenefit);
  });
});

describe('taxableSocialSecurity', () => {
  it('is zero when there is no benefit', () => {
    expect(taxableSocialSecurity(0, 50_000, 'single').taxableAmount).toBe(0);
  });

  it('is zero when combined income does not clear the first threshold', () => {
    // combined = 10,000 + 0.5*20,000 = 20,000, under 25,000
    expect(taxableSocialSecurity(20_000, 10_000, 'single').taxableAmount).toBe(0);
  });

  it('taxes up to 50% between the two thresholds', () => {
    // combined = 20,000 + 0.5*20,000 = 30,000; 30,000-25,000 = 5,000; 50% of that is 2,500; 50% of benefit is 10,000 - the lesser wins
    const result = taxableSocialSecurity(20_000, 20_000, 'single');
    expect(result.taxableAmount).toBeCloseTo(2_500, 5);
  });

  it('taxes up to 85% above the second threshold', () => {
    const result = taxableSocialSecurity(26_400, 40_000, 'single');
    const combined = 40_000 + 0.5 * 26_400;
    const expected = Math.min(0.85 * 26_400, 0.85 * (combined - 34_000) + Math.min(6_000, 0.5 * 26_400));
    expect(result.taxableAmount).toBeCloseTo(expected, 5);
  });

  it('never taxes more than 85% of the benefit no matter how high other income is', () => {
    const result = taxableSocialSecurity(26_400, 1_000_000, 'single');
    expect(result.taxableAmount).toBeCloseTo(0.85 * 26_400, 5);
  });

  it('uses the higher married-filing-jointly thresholds', () => {
    // combined = 20,000 + 0.5*20,000 = 30,000 - under single's 34,000 second threshold but also under MFJ's 32,000 first threshold? No: 30,000 > 32,000 is false, so MFJ should be 0.
    const mfj = taxableSocialSecurity(20_000, 20_000, 'marriedFilingJointly');
    const single = taxableSocialSecurity(20_000, 20_000, 'single');
    expect(mfj.taxableAmount).toBe(0);
    expect(single.taxableAmount).toBeGreaterThan(0);
  });
});
