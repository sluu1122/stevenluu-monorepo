import type { FederalTaxTable } from './schema';

/**
 * Seeded 2026 defaults, user-editable in Scenario Setup. Sources: Tax
 * Foundation (US federal brackets/standard deduction) and CRA (Canada
 * federal brackets/Basic Personal Amount), as published in 2026.
 */

export const US_FEDERAL_2026_SINGLE: FederalTaxTable = {
  country: 'US',
  year: 2026,
  filingStatus: 'single',
  standardDeductionOrBPA: 16_100,
  brackets: [
    { min: 0, max: 11_925, rate: 0.10 },
    { min: 11_925, max: 48_475, rate: 0.12 },
    { min: 48_475, max: 103_350, rate: 0.22 },
    { min: 103_350, max: 197_300, rate: 0.24 },
    { min: 197_300, max: 250_525, rate: 0.32 },
    { min: 250_525, max: 626_350, rate: 0.35 },
    { min: 626_350, max: null, rate: 0.37 },
  ],
};

export const US_FEDERAL_2026_MFJ: FederalTaxTable = {
  country: 'US',
  year: 2026,
  filingStatus: 'marriedFilingJointly',
  standardDeductionOrBPA: 32_200,
  brackets: US_FEDERAL_2026_SINGLE.brackets.map((b) => ({
    min: b.min * 2,
    max: b.max === null ? null : b.max * 2,
    rate: b.rate,
  })),
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
