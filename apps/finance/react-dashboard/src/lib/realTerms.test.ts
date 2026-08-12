import { describe, expect, test } from 'vitest';
import { cumulativeInflationByYear, buildDeflate, NOMINAL } from './realTerms';
import { createDemoScenarios } from '../engine/demoScenarios';
import { buildScenarioLedger } from '../engine/ledger';
import type { InflationAssumption } from '../engine/schema';

const flat = (pct: number): InflationAssumption => ({ mode: 'flat', flatRatePct: pct });

describe('cumulativeInflationByYear', () => {
  test('the first projected year is 1 - it is already today', () => {
    const factors = cumulativeInflationByYear(flat(2.5), [2026, 2027, 2028]);
    expect(factors.get(2026)).toBe(1);
  });

  test('compounds one year at a time after that', () => {
    const factors = cumulativeInflationByYear(flat(10), [2026, 2027, 2028]);
    expect(factors.get(2027)).toBeCloseTo(1.1, 10);
    expect(factors.get(2028)).toBeCloseTo(1.21, 10);
  });

  test('zero inflation leaves every year at 1', () => {
    const factors = cumulativeInflationByYear(flat(0), [2026, 2027, 2028]);
    expect([...factors.values()]).toEqual([1, 1, 1]);
  });

  test('unsorted or duplicated input still compounds in year order', () => {
    const factors = cumulativeInflationByYear(flat(10), [2028, 2026, 2027, 2027]);
    expect(factors.get(2026)).toBe(1);
    expect(factors.get(2028)).toBeCloseTo(1.21, 10);
  });
});

describe('buildDeflate', () => {
  test('divides a nominal figure back to today', () => {
    const deflate = buildDeflate(flat(10), [2026, 2027]);
    expect(deflate(110, 2027)).toBeCloseTo(100, 10);
    expect(deflate(100, 2026)).toBe(100);
  });

  test('leaves an unknown year nominal rather than guessing', () => {
    const deflate = buildDeflate(flat(10), [2026, 2027]);
    expect(deflate(500, 2099)).toBe(500);
  });

  test('NOMINAL is the identity', () => {
    expect(NOMINAL(1234, 2050)).toBe(1234);
  });
});

describe('agreement with the engine', () => {
  // The one real drift risk: this helper re-derives the factor rather than
  // reading it off the row, so it could disagree with the engine about WHICH
  // years inflation applies to.
  //
  // Compared only against PRE-RETIREMENT rows, on purpose. The engine inflates
  // spending in two phases and restarts the factor at retirement, so
  // `householdSpendingRealAtRetirement` is denominated in retirement-year
  // dollars rather than today's - `spendingNominal / spendingReal` drops back to
  // 1.0 in the retirement year. This helper is a deflator for NET WORTH, which
  // compounds continuously from the first projected year and never resets, so
  // the two only coincide before retirement. That overlap is still enough to
  // catch the drift this test exists for.
  test.each(createDemoScenarios().map((s) => [s.name, s] as const))('matches the engine pre-retirement for %s', (_name, scenario) => {
    const { plan, result } = buildScenarioLedger(scenario, [])[0];
    const years = result.rows.map((r) => r.year);
    const factors = cumulativeInflationByYear(scenario.inflation, years);

    const checked = result.rows.filter((row) => row.spendingReal > 0 && row.year < plan.retirementStartYear!);
    expect(checked.length, 'no pre-retirement rows to compare against').toBeGreaterThan(5);

    for (const row of checked) {
      // Household spending is split across people, but the ratio is the same
      // for any nonzero share, so it isolates the inflation factor.
      expect(row.spendingNominal / row.spendingReal, `year ${row.year}`).toBeCloseTo(factors.get(row.year)!, 6);
    }
  });

  test('the retirement reset is real, not an artefact of this helper', () => {
    // Pins the behaviour the comment above depends on. If the engine is ever
    // changed so retirement spending is denominated in today's dollars, this
    // fails and the comment above needs revisiting rather than quietly rotting.
    const scenario = createDemoScenarios()[0];
    const { plan, result } = buildScenarioLedger(scenario, [])[0];
    const firstRetired = result.rows.find((r) => r.year === plan.retirementStartYear)!;
    expect(firstRetired.spendingNominal / firstRetired.spendingReal).toBeCloseTo(1, 6);
  });
});
