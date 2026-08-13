import type { FederalTaxTable } from './schema';

/**
 * Seeded 2026 defaults, user-editable in Scenario Setup. Sources: IRS
 * Rev. Proc. 2025-32 (US federal brackets and standard deduction) and CRA
 * (Canada federal brackets and Basic Personal Amount).
 *
 * The US brackets were previously the 2025 thresholds sitting under a 2026
 * standard deduction - a mixed vintage that quietly overstated tax, since the
 * 2026 brackets are all wider. Both halves are now the same year.
 */

export const US_FEDERAL_2026_SINGLE: FederalTaxTable = {
  country: 'US',
  year: 2026,
  filingStatus: 'single',
  standardDeductionOrBPA: 16_100,
  brackets: [
    { min: 0, max: 12_400, rate: 0.10 },
    { min: 12_400, max: 50_400, rate: 0.12 },
    { min: 50_400, max: 105_700, rate: 0.22 },
    { min: 105_700, max: 201_775, rate: 0.24 },
    { min: 201_775, max: 256_225, rate: 0.32 },
    { min: 256_225, max: 640_600, rate: 0.35 },
    { min: 640_600, max: null, rate: 0.37 },
  ],
};

/**
 * Stated in full rather than doubling the single-filer thresholds.
 *
 * Doubling is right for the first six brackets and WRONG for the last one: the
 * married-filing-jointly 37% bracket starts at 768,700, not twice the single
 * filer's 640,600. Deriving the table by doubling therefore taxed roughly half
 * a million dollars of joint income at 35% when it should have been 37% - the
 * "marriage penalty" in the top bracket, which is deliberate in the statute and
 * is the one place the brackets are not simply scaled.
 */
export const US_FEDERAL_2026_MFJ: FederalTaxTable = {
  country: 'US',
  year: 2026,
  filingStatus: 'marriedFilingJointly',
  standardDeductionOrBPA: 32_200,
  brackets: [
    { min: 0, max: 24_800, rate: 0.10 },
    { min: 24_800, max: 100_800, rate: 0.12 },
    { min: 100_800, max: 211_400, rate: 0.22 },
    { min: 211_400, max: 403_550, rate: 0.24 },
    { min: 403_550, max: 512_450, rate: 0.32 },
    { min: 512_450, max: 768_700, rate: 0.35 },
    { min: 768_700, max: null, rate: 0.37 },
  ],
};

export const CA_FEDERAL_2026: FederalTaxTable = {
  country: 'CA',
  year: 2026,
  filingStatus: 'single',
  standardDeductionOrBPA: 16_452,
  brackets: [
    { min: 0, max: 58_523, rate: 0.14 },
    { min: 58_523, max: 117_045, rate: 0.205 },
    { min: 117_045, max: 181_440, rate: 0.26 },
    { min: 181_440, max: 258_482, rate: 0.29 },
    { min: 258_482, max: null, rate: 0.33 },
  ],
};

export function getDefaultFederalTable(country: 'US' | 'CA', filingStatus: 'single' | 'marriedFilingJointly'): FederalTaxTable {
  if (country === 'CA') return CA_FEDERAL_2026;
  return filingStatus === 'marriedFilingJointly' ? US_FEDERAL_2026_MFJ : US_FEDERAL_2026_SINGLE;
}
