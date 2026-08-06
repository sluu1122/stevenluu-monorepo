import type { StateOrProvincialTaxTable } from './schema';

/**
 * Seeded provincial and state tax tables, as presets the user picks from.
 *
 * These replace what used to be a single flat percentage of gross income. That
 * flat rate was wrong in both directions at once - it charged tax on the first
 * dollar with no personal amount, and it charged the same rate on the
 * two-hundred-thousandth - and the second error dominates in any plan that
 * withdraws large amounts from a registered account.
 *
 * Figures are 2025 tax year, the last full year published as of writing.
 * Brackets are NOT indexed here; the ledger indexes them forward each year
 * from `indexTaxThresholdsToInflation`, the same as the federal table.
 *
 * Every province grants its basic personal amount as a non-refundable credit
 * at its own lowest rate, which is what `creditRate` holds.
 */
export const PROVINCIAL_TAX_TABLES: Record<string, StateOrProvincialTaxTable> = {
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
  US_NO_STATE_TAX: {
    label: 'No state income tax',
    brackets: [{ min: 0, max: null, rate: 0 }],
    basicPersonalAmount: 0,
    creditRate: 0,
    surtax: [],
  },
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
