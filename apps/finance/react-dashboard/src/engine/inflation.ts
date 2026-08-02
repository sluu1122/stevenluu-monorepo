import type { InflationAssumption } from './schema';

/** Returns the decimal inflation rate (e.g. 0.025 for 2.5%) for a given year. */
export function getInflationRateForYear(inflation: InflationAssumption, year: number): number {
  if (inflation.mode === 'byYear') {
    const override = inflation.byYear?.find((y) => y.year === year);
    if (override) return override.ratePct / 100;
  }
  return (inflation.flatRatePct ?? 0) / 100;
}
