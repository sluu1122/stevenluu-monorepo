import type { StateOrProvincialTaxTable } from './schema';

/**
 * Seeded province/territory and state tax tables, as presets the user picks
 * from. Split into two maps rather than one, so the picker in Tax Assumptions
 * can show only the tables that match the scenario's own tax residency - a
 * Canadian scenario has no business offering California's brackets.
 *
 * These replace what used to be a single flat percentage of gross income. That
 * flat rate was wrong in both directions at once - it charged tax on the first
 * dollar with no personal amount, and it charged the same rate on the
 * two-hundred-thousandth - and the second error dominates in any plan that
 * withdraws large amounts from a registered account.
 *
 * Figures are single-filer, 2025 tax year, and approximate: a state or
 * province updates its own brackets annually, several of these are mid-way
 * through a multi-year legislated rate cut, and none of it is indexed here -
 * the ledger indexes forward from `indexTaxThresholdsToInflation`, the same as
 * the federal table. Treat every number as a seeded starting point to verify
 * and edit, not as a filed return - exactly the same posture the app already
 * takes with its federal tables and its benefit defaults.
 *
 * The basic personal amount / standard deduction is modelled as a CREDIT at
 * `creditRate`, applied to the tax bill rather than subtracted from income -
 * that's the literal mechanism for every Canadian province, and an
 * approximation for most US states (which subtract it from income instead).
 * The approximation is exact for a FLAT-rate state, since crediting `amount ×
 * rate` and deducting `amount` before applying that same flat `rate` produce
 * the same tax bill either way; it understates the deduction's value for a
 * graduated state's lower earners and overstates it for their higher earners,
 * the same trade-off already accepted for the federal BPA (see calculateTax.ts).
 */

function noTax(label: string): StateOrProvincialTaxTable {
  return { label, brackets: [{ min: 0, max: null, rate: 0 }], basicPersonalAmount: 0, creditRate: 0, surtax: [] };
}

/** A flat-rate table. Exact under the credit approximation above, since there's only one rate to apply it at. */
function flatState(label: string, ratePct: number, standardDeduction: number): StateOrProvincialTaxTable {
  return { label, brackets: [{ min: 0, max: null, rate: ratePct / 100 }], basicPersonalAmount: standardDeduction, creditRate: ratePct / 100, surtax: [] };
}

export const CANADIAN_TAX_TABLES: Record<string, StateOrProvincialTaxTable> = {
  BC: {
    label: 'British Columbia',
    brackets: [
      { min: 0, max: 49_279, rate: 0.0506 },
      { min: 49_279, max: 98_560, rate: 0.077 },
      { min: 98_560, max: 113_158, rate: 0.105 },
      { min: 113_158, max: 137_407, rate: 0.1229 },
      { min: 137_407, max: 186_306, rate: 0.147 },
      { min: 186_306, max: 259_829, rate: 0.168 },
      { min: 259_829, max: null, rate: 0.205 },
    ],
    basicPersonalAmount: 12_932,
    creditRate: 0.0506,
    surtax: [],
  },
  AB: {
    label: 'Alberta',
    brackets: [
      { min: 0, max: 60_000, rate: 0.08 },
      { min: 60_000, max: 151_234, rate: 0.1 },
      { min: 151_234, max: 181_481, rate: 0.12 },
      { min: 181_481, max: 241_974, rate: 0.13 },
      { min: 241_974, max: 362_961, rate: 0.14 },
      { min: 362_961, max: null, rate: 0.15 },
    ],
    basicPersonalAmount: 22_323,
    creditRate: 0.08,
    surtax: [],
  },
  SK: {
    label: 'Saskatchewan',
    brackets: [
      { min: 0, max: 53_463, rate: 0.105 },
      { min: 53_463, max: 152_750, rate: 0.125 },
      { min: 152_750, max: null, rate: 0.145 },
    ],
    basicPersonalAmount: 19_491,
    creditRate: 0.105,
    surtax: [],
  },
  MB: {
    label: 'Manitoba',
    brackets: [
      { min: 0, max: 47_564, rate: 0.108 },
      { min: 47_564, max: 101_200, rate: 0.1275 },
      { min: 101_200, max: null, rate: 0.174 },
    ],
    basicPersonalAmount: 15_969,
    creditRate: 0.108,
    surtax: [],
  },
  ON: {
    label: 'Ontario',
    brackets: [
      { min: 0, max: 52_886, rate: 0.0505 },
      { min: 52_886, max: 105_775, rate: 0.0915 },
      { min: 105_775, max: 150_000, rate: 0.1116 },
      { min: 150_000, max: 220_000, rate: 0.1216 },
      { min: 220_000, max: null, rate: 0.1316 },
    ],
    basicPersonalAmount: 12_747,
    creditRate: 0.0505,
    // Ontario alone charges a tax ON the tax. Both bands apply cumulatively,
    // so income in the top band carries 20% + 36% = 56% of the excess.
    surtax: [
      { taxOver: 5_710, rate: 0.2 },
      { taxOver: 7_307, rate: 0.36 },
    ],
  },
  QC: {
    label: 'Quebec',
    brackets: [
      { min: 0, max: 53_255, rate: 0.14 },
      { min: 53_255, max: 106_495, rate: 0.19 },
      { min: 106_495, max: 129_590, rate: 0.24 },
      { min: 129_590, max: null, rate: 0.2575 },
    ],
    basicPersonalAmount: 18_571,
    creditRate: 0.14,
    surtax: [],
  },
  NB: {
    label: 'New Brunswick',
    brackets: [
      { min: 0, max: 51_306, rate: 0.094 },
      { min: 51_306, max: 102_614, rate: 0.14 },
      { min: 102_614, max: null, rate: 0.16 },
    ],
    basicPersonalAmount: 13_396,
    creditRate: 0.094,
    surtax: [],
  },
  NS: {
    label: 'Nova Scotia',
    brackets: [
      { min: 0, max: 30_507, rate: 0.0879 },
      { min: 30_507, max: 61_015, rate: 0.1495 },
      { min: 61_015, max: 95_883, rate: 0.1667 },
      { min: 95_883, max: 154_650, rate: 0.175 },
      { min: 154_650, max: null, rate: 0.21 },
    ],
    basicPersonalAmount: 11_894,
    creditRate: 0.0879,
    surtax: [],
  },
  PE: {
    label: 'Prince Edward Island',
    brackets: [
      { min: 0, max: 33_328, rate: 0.095 },
      { min: 33_328, max: 64_656, rate: 0.1347 },
      { min: 64_656, max: 105_000, rate: 0.166 },
      { min: 105_000, max: 140_000, rate: 0.1762 },
      { min: 140_000, max: null, rate: 0.19 },
    ],
    basicPersonalAmount: 14_250,
    creditRate: 0.095,
    surtax: [],
  },
  NL: {
    label: 'Newfoundland and Labrador',
    brackets: [
      { min: 0, max: 44_192, rate: 0.087 },
      { min: 44_192, max: 88_382, rate: 0.145 },
      { min: 88_382, max: 157_792, rate: 0.158 },
      { min: 157_792, max: 220_910, rate: 0.178 },
      { min: 220_910, max: 282_214, rate: 0.198 },
      { min: 282_214, max: 564_429, rate: 0.208 },
      { min: 564_429, max: null, rate: 0.218 },
    ],
    basicPersonalAmount: 11_067,
    creditRate: 0.087,
    surtax: [],
  },
  YT: {
    label: 'Yukon',
    brackets: [
      { min: 0, max: 57_375, rate: 0.064 },
      { min: 57_375, max: 114_750, rate: 0.09 },
      { min: 114_750, max: 177_882, rate: 0.109 },
      { min: 177_882, max: 500_000, rate: 0.128 },
      { min: 500_000, max: null, rate: 0.15 },
    ],
    basicPersonalAmount: 16_129,
    creditRate: 0.064,
    surtax: [],
  },
  NT: {
    label: 'Northwest Territories',
    brackets: [
      { min: 0, max: 51_964, rate: 0.059 },
      { min: 51_964, max: 103_930, rate: 0.086 },
      { min: 103_930, max: 168_967, rate: 0.122 },
      { min: 168_967, max: null, rate: 0.1405 },
    ],
    basicPersonalAmount: 17_842,
    creditRate: 0.059,
    surtax: [],
  },
  NU: {
    label: 'Nunavut',
    brackets: [
      { min: 0, max: 54_707, rate: 0.04 },
      { min: 54_707, max: 109_413, rate: 0.07 },
      { min: 109_413, max: 177_881, rate: 0.09 },
      { min: 177_881, max: null, rate: 0.115 },
    ],
    basicPersonalAmount: 19_798,
    creditRate: 0.04,
    surtax: [],
  },
};

/**
 * All 50 US states, single-filer. Nine have no wage income tax at all;
 * several more are flat rate, many of them mid-way through a legislated,
 * multi-year phase-down (Georgia, Louisiana, Mississippi, Missouri, Nebraska,
 * North Carolina among them) - the rate here is the 2025 step of that
 * schedule, not necessarily where it will land once fully phased in.
 */
export const US_STATE_TAX_TABLES: Record<string, StateOrProvincialTaxTable> = {
  AL: {
    label: 'Alabama',
    brackets: [
      { min: 0, max: 500, rate: 0.02 },
      { min: 500, max: 3_000, rate: 0.04 },
      { min: 3_000, max: null, rate: 0.05 },
    ],
    basicPersonalAmount: 2_500,
    creditRate: 0.02,
    surtax: [],
  },
  AK: noTax('Alaska'),
  AZ: flatState('Arizona', 2.5, 14_600),
  AR: {
    label: 'Arkansas',
    brackets: [
      { min: 0, max: 5_300, rate: 0 },
      { min: 5_300, max: 10_600, rate: 0.02 },
      { min: 10_600, max: 15_000, rate: 0.03 },
      { min: 15_000, max: 25_000, rate: 0.034 },
      { min: 25_000, max: null, rate: 0.039 },
    ],
    basicPersonalAmount: 2_270,
    creditRate: 0,
    surtax: [],
  },
  CA: {
    label: 'California',
    brackets: [
      { min: 0, max: 10_756, rate: 0.01 },
      { min: 10_756, max: 25_499, rate: 0.02 },
      { min: 25_499, max: 40_245, rate: 0.04 },
      { min: 40_245, max: 55_866, rate: 0.06 },
      { min: 55_866, max: 70_606, rate: 0.08 },
      { min: 70_606, max: 360_659, rate: 0.093 },
      { min: 360_659, max: 432_787, rate: 0.103 },
      { min: 432_787, max: 721_314, rate: 0.113 },
      { min: 721_314, max: 1_000_000, rate: 0.123 },
      // The 1% Mental Health Services surcharge on income over $1M, folded in
      // as a top bracket rather than the tax-based `surtax` field, since this
      // one is levied on INCOME above a threshold rather than on the tax bill.
      { min: 1_000_000, max: null, rate: 0.133 },
    ],
    // California's own personal exemption really is a small CREDIT, not a
    // deduction - about $149 for a single filer - which this reproduces
    // exactly rather than approximating: 14,900 × 1% = 149.
    basicPersonalAmount: 14_900,
    creditRate: 0.01,
    surtax: [],
  },
  CO: flatState('Colorado', 4.4, 14_600),
  CT: {
    label: 'Connecticut',
    brackets: [
      { min: 0, max: 10_000, rate: 0.02 },
      { min: 10_000, max: 50_000, rate: 0.045 },
      { min: 50_000, max: 100_000, rate: 0.055 },
      { min: 100_000, max: 200_000, rate: 0.06 },
      { min: 200_000, max: 250_000, rate: 0.065 },
      { min: 250_000, max: 500_000, rate: 0.069 },
      { min: 500_000, max: null, rate: 0.0699 },
    ],
    basicPersonalAmount: 15_000,
    creditRate: 0.02,
    surtax: [],
  },
  DE: {
    label: 'Delaware',
    brackets: [
      { min: 0, max: 2_000, rate: 0 },
      { min: 2_000, max: 5_000, rate: 0.022 },
      { min: 5_000, max: 10_000, rate: 0.039 },
      { min: 10_000, max: 20_000, rate: 0.048 },
      { min: 20_000, max: 25_000, rate: 0.052 },
      { min: 25_000, max: 60_000, rate: 0.0555 },
      { min: 60_000, max: null, rate: 0.066 },
    ],
    basicPersonalAmount: 3_250,
    creditRate: 0,
    surtax: [],
  },
  FL: noTax('Florida'),
  GA: flatState('Georgia', 5.19, 12_000),
  HI: {
    label: 'Hawaii',
    brackets: [
      { min: 0, max: 9_600, rate: 0.014 },
      { min: 9_600, max: 14_400, rate: 0.032 },
      { min: 14_400, max: 19_200, rate: 0.055 },
      { min: 19_200, max: 24_000, rate: 0.064 },
      { min: 24_000, max: 36_000, rate: 0.068 },
      { min: 36_000, max: 48_000, rate: 0.072 },
      { min: 48_000, max: 125_000, rate: 0.076 },
      { min: 125_000, max: 175_000, rate: 0.079 },
      { min: 175_000, max: 225_000, rate: 0.0825 },
      { min: 225_000, max: 275_000, rate: 0.09 },
      { min: 275_000, max: 325_000, rate: 0.1 },
      { min: 325_000, max: null, rate: 0.11 },
    ],
    // Hawaii's 2024 reform is raising the standard deduction in steps through
    // 2031; this is roughly the mid-phase 2025 figure, not the eventual one.
    basicPersonalAmount: 9_000,
    creditRate: 0.014,
    surtax: [],
  },
  ID: flatState('Idaho', 5.3, 14_600),
  IL: flatState('Illinois', 4.95, 2_775),
  IN: flatState('Indiana', 3.0, 1_000),
  IA: flatState('Iowa', 3.8, 2_750),
  KS: {
    label: 'Kansas',
    brackets: [
      { min: 0, max: 23_000, rate: 0.052 },
      { min: 23_000, max: null, rate: 0.0558 },
    ],
    basicPersonalAmount: 3_605,
    creditRate: 0.052,
    surtax: [],
  },
  KY: flatState('Kentucky', 4.0, 3_160),
  LA: flatState('Louisiana', 3.0, 12_500),
  ME: {
    label: 'Maine',
    brackets: [
      { min: 0, max: 26_050, rate: 0.058 },
      { min: 26_050, max: 61_600, rate: 0.0675 },
      { min: 61_600, max: null, rate: 0.0715 },
    ],
    basicPersonalAmount: 14_600,
    creditRate: 0.058,
    surtax: [],
  },
  MD: {
    label: 'Maryland',
    brackets: [
      { min: 0, max: 1_000, rate: 0.02 },
      { min: 1_000, max: 2_000, rate: 0.03 },
      { min: 2_000, max: 3_000, rate: 0.04 },
      { min: 3_000, max: 100_000, rate: 0.0475 },
      { min: 100_000, max: 125_000, rate: 0.05 },
      { min: 125_000, max: 150_000, rate: 0.0525 },
      { min: 150_000, max: 250_000, rate: 0.055 },
      { min: 250_000, max: null, rate: 0.0575 },
    ],
    basicPersonalAmount: 3_200,
    creditRate: 0.02,
    surtax: [],
  },
  MA: {
    label: 'Massachusetts',
    brackets: [
      { min: 0, max: 1_000_000, rate: 0.05 },
      // The "Fair Share" surtax adds 4% above $1M - folded in as a bracket for
      // the same reason as California's: it applies to income, not to tax.
      { min: 1_000_000, max: null, rate: 0.09 },
    ],
    basicPersonalAmount: 4_400,
    creditRate: 0.05,
    surtax: [],
  },
  MI: flatState('Michigan', 4.25, 5_600),
  MN: {
    label: 'Minnesota',
    brackets: [
      { min: 0, max: 31_690, rate: 0.0535 },
      { min: 31_690, max: 104_090, rate: 0.068 },
      { min: 104_090, max: 193_240, rate: 0.0785 },
      { min: 193_240, max: null, rate: 0.0985 },
    ],
    basicPersonalAmount: 14_575,
    creditRate: 0.0535,
    surtax: [],
  },
  MS: {
    label: 'Mississippi',
    brackets: [
      { min: 0, max: 10_000, rate: 0 },
      { min: 10_000, max: null, rate: 0.044 },
    ],
    basicPersonalAmount: 0,
    creditRate: 0,
    surtax: [],
  },
  MO: {
    label: 'Missouri',
    brackets: [
      { min: 0, max: 1_313, rate: 0 },
      { min: 1_313, max: 2_626, rate: 0.02 },
      { min: 2_626, max: 3_939, rate: 0.025 },
      { min: 3_939, max: 5_252, rate: 0.03 },
      { min: 5_252, max: 6_565, rate: 0.035 },
      { min: 6_565, max: 7_878, rate: 0.04 },
      { min: 7_878, max: 9_191, rate: 0.045 },
      { min: 9_191, max: null, rate: 0.047 },
    ],
    basicPersonalAmount: 14_600,
    creditRate: 0,
    surtax: [],
  },
  MT: {
    label: 'Montana',
    brackets: [
      { min: 0, max: 20_500, rate: 0.047 },
      { min: 20_500, max: null, rate: 0.059 },
    ],
    basicPersonalAmount: 14_600,
    creditRate: 0.047,
    surtax: [],
  },
  NE: {
    label: 'Nebraska',
    brackets: [
      { min: 0, max: 3_700, rate: 0.0246 },
      { min: 3_700, max: 22_170, rate: 0.0351 },
      { min: 22_170, max: 35_730, rate: 0.0501 },
      { min: 35_730, max: null, rate: 0.052 },
    ],
    basicPersonalAmount: 7_900,
    creditRate: 0.0246,
    surtax: [],
  },
  NV: noTax('Nevada'),
  NH: noTax('New Hampshire'),
  NJ: {
    label: 'New Jersey',
    brackets: [
      { min: 0, max: 20_000, rate: 0.014 },
      { min: 20_000, max: 35_000, rate: 0.0175 },
      { min: 35_000, max: 40_000, rate: 0.035 },
      { min: 40_000, max: 75_000, rate: 0.05525 },
      { min: 75_000, max: 500_000, rate: 0.0637 },
      { min: 500_000, max: 1_000_000, rate: 0.0897 },
      { min: 1_000_000, max: null, rate: 0.1075 },
    ],
    basicPersonalAmount: 1_000,
    creditRate: 0.014,
    surtax: [],
  },
  NM: {
    label: 'New Mexico',
    brackets: [
      { min: 0, max: 5_500, rate: 0.017 },
      { min: 5_500, max: 11_000, rate: 0.032 },
      { min: 11_000, max: 16_000, rate: 0.047 },
      { min: 16_000, max: 210_000, rate: 0.049 },
      { min: 210_000, max: null, rate: 0.059 },
    ],
    basicPersonalAmount: 14_600,
    creditRate: 0.017,
    surtax: [],
  },
  NY: {
    label: 'New York',
    brackets: [
      { min: 0, max: 8_500, rate: 0.04 },
      { min: 8_500, max: 11_700, rate: 0.045 },
      { min: 11_700, max: 13_900, rate: 0.0525 },
      { min: 13_900, max: 80_650, rate: 0.055 },
      { min: 80_650, max: 215_400, rate: 0.06 },
      { min: 215_400, max: 1_077_550, rate: 0.0685 },
      { min: 1_077_550, max: 5_000_000, rate: 0.0965 },
      { min: 5_000_000, max: 25_000_000, rate: 0.103 },
      { min: 25_000_000, max: null, rate: 0.109 },
    ],
    basicPersonalAmount: 8_000,
    creditRate: 0.04,
    surtax: [],
  },
  NC: flatState('North Carolina', 4.25, 12_750),
  ND: {
    label: 'North Dakota',
    brackets: [
      { min: 0, max: 47_150, rate: 0 },
      { min: 47_150, max: null, rate: 0.0195 },
    ],
    basicPersonalAmount: 0,
    creditRate: 0,
    surtax: [],
  },
  OH: {
    label: 'Ohio',
    brackets: [
      { min: 0, max: 26_050, rate: 0 },
      { min: 26_050, max: 100_000, rate: 0.0275 },
      { min: 100_000, max: null, rate: 0.035 },
    ],
    basicPersonalAmount: 0,
    creditRate: 0,
    surtax: [],
  },
  OK: {
    label: 'Oklahoma',
    brackets: [
      { min: 0, max: 1_000, rate: 0.0025 },
      { min: 1_000, max: 2_500, rate: 0.0075 },
      { min: 2_500, max: 3_750, rate: 0.0175 },
      { min: 3_750, max: 4_900, rate: 0.0275 },
      { min: 4_900, max: 7_200, rate: 0.0375 },
      { min: 7_200, max: null, rate: 0.0475 },
    ],
    basicPersonalAmount: 6_350,
    creditRate: 0.0025,
    surtax: [],
  },
  OR: {
    label: 'Oregon',
    brackets: [
      { min: 0, max: 4_300, rate: 0.0475 },
      { min: 4_300, max: 10_750, rate: 0.0675 },
      { min: 10_750, max: 125_000, rate: 0.0875 },
      { min: 125_000, max: null, rate: 0.099 },
    ],
    basicPersonalAmount: 2_745,
    creditRate: 0.0475,
    surtax: [],
  },
  PA: flatState('Pennsylvania', 3.07, 0),
  RI: {
    label: 'Rhode Island',
    brackets: [
      { min: 0, max: 73_450, rate: 0.0375 },
      { min: 73_450, max: 166_950, rate: 0.0475 },
      { min: 166_950, max: null, rate: 0.0599 },
    ],
    basicPersonalAmount: 10_550,
    creditRate: 0.0375,
    surtax: [],
  },
  SC: {
    label: 'South Carolina',
    brackets: [
      { min: 0, max: 3_560, rate: 0 },
      { min: 3_560, max: 17_830, rate: 0.03 },
      { min: 17_830, max: null, rate: 0.062 },
    ],
    basicPersonalAmount: 14_600,
    creditRate: 0,
    surtax: [],
  },
  SD: noTax('South Dakota'),
  TN: noTax('Tennessee'),
  TX: noTax('Texas'),
  UT: flatState('Utah', 4.5, 1_750),
  VT: {
    label: 'Vermont',
    brackets: [
      { min: 0, max: 47_900, rate: 0.0335 },
      { min: 47_900, max: 116_050, rate: 0.066 },
      { min: 116_050, max: 242_000, rate: 0.076 },
      { min: 242_000, max: null, rate: 0.0875 },
    ],
    basicPersonalAmount: 7_000,
    creditRate: 0.0335,
    surtax: [],
  },
  VA: {
    label: 'Virginia',
    brackets: [
      { min: 0, max: 3_000, rate: 0.02 },
      { min: 3_000, max: 5_000, rate: 0.03 },
      { min: 5_000, max: 17_000, rate: 0.05 },
      { min: 17_000, max: null, rate: 0.0575 },
    ],
    basicPersonalAmount: 8_500,
    creditRate: 0.02,
    surtax: [],
  },
  // No general wage income tax. Washington does levy a 7% excise tax on
  // capital gains above roughly $270,000 for high earners, which this doesn't
  // model - the closest fit in this schema is "no tax", not a good one.
  WA: noTax('Washington'),
  WV: {
    label: 'West Virginia',
    brackets: [
      { min: 0, max: 10_000, rate: 0.0236 },
      { min: 10_000, max: 25_000, rate: 0.0315 },
      { min: 25_000, max: 40_000, rate: 0.0354 },
      { min: 40_000, max: 60_000, rate: 0.0472 },
      { min: 60_000, max: null, rate: 0.0482 },
    ],
    basicPersonalAmount: 0,
    creditRate: 0,
    surtax: [],
  },
  WI: {
    label: 'Wisconsin',
    brackets: [
      { min: 0, max: 14_320, rate: 0.035 },
      { min: 14_320, max: 28_640, rate: 0.044 },
      { min: 28_640, max: 315_310, rate: 0.053 },
      { min: 315_310, max: null, rate: 0.0765 },
    ],
    basicPersonalAmount: 13_230,
    creditRate: 0.035,
    surtax: [],
  },
  WY: noTax('Wyoming'),
};

/** A single flat rate expressed as a table, for migrating a pre-v8 scenario without changing its numbers. */
export function flatRateTable(ratePct: number): StateOrProvincialTaxTable {
  return {
    label: `Flat ${ratePct}%`,
    brackets: [{ min: 0, max: null, rate: ratePct / 100 }],
    basicPersonalAmount: 0,
    creditRate: 0,
    surtax: [],
  };
}
