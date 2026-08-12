import { getInflationRateForYear } from '../engine/inflation';
import type { InflationAssumption } from '../engine/schema';

/**
 * Cumulative inflation from the first projected year, so a nominal figure can be
 * divided back into today's dollars.
 *
 * Deliberately mirrors the engine's own `indexationFactor`
 * (`ledger.ts`, "Phase 0"): the first year is 1, and every year after it
 * multiplies by that year's rate. It reuses `getInflationRateForYear` rather
 * than re-deriving a rate, so the two cannot disagree about what a year's
 * inflation is - only about which years it applies to, which the test pins.
 *
 * Assumes `years` is the contiguous run of projected years the ledger produced.
 * A gap would compound as though the missing years never happened.
 */
export function cumulativeInflationByYear(inflation: InflationAssumption, years: number[]): Map<number, number> {
  const sorted = [...new Set(years)].sort((a, b) => a - b);
  const factors = new Map<number, number>();
  let factor = 1;
  sorted.forEach((year, index) => {
    if (index > 0) factor *= 1 + getInflationRateForYear(inflation, year);
    factors.set(year, factor);
  });
  return factors;
}

/** How a chart re-expresses one figure. Identity when showing nominal dollars. */
export type Deflate = (value: number, year: number) => number;

export const NOMINAL: Deflate = (value) => value;

/**
 * Builds the today's-dollars conversion for one scenario's projected years.
 *
 * Applied at the render boundary, on top of whatever the currency toggle
 * already did - both are scalar multiplications, so the order between them
 * doesn't matter.
 */
export function buildDeflate(inflation: InflationAssumption, years: number[]): Deflate {
  const factors = cumulativeInflationByYear(inflation, years);
  return (value, year) => {
    const factor = factors.get(year);
    // An unknown year means the caller mixed series - leave it nominal rather
    // than silently deflating by the wrong amount.
    return factor && factor > 0 ? value / factor : value;
  };
}
