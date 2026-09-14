import { describe, expect, it } from 'vitest';
import { describeAssumptions } from './assumptionsSummary';
import { createDefaultScenario } from '../engine/defaults';
import type { Scenario } from '../engine/schema';

function scenarioWith(patch: Partial<Scenario>): Scenario {
  return { ...createDefaultScenario('CA'), ...patch };
}

describe('describeAssumptions', () => {
  it('collapses the two investment rates into one when they agree', () => {
    const s = scenarioWith({ returnRates: { investmentsPreRetirementPct: 6, investmentsPostRetirementPct: 6, cashPct: 2 } });
    expect(describeAssumptions(s)).toContain('6% returns');
    expect(describeAssumptions(s)).not.toContain('before retirement');
  });

  it('names both rates when they differ, which is the case worth seeing', () => {
    const s = scenarioWith({ returnRates: { investmentsPreRetirementPct: 7, investmentsPostRetirementPct: 4, cashPct: 2 } });
    expect(describeAssumptions(s)).toContain('7% returns before retirement, 4% after');
  });

  it('always reports the cash rate and the inflation rate', () => {
    const s = scenarioWith({
      returnRates: { investmentsPreRetirementPct: 6, investmentsPostRetirementPct: 6, cashPct: 2.5 },
      inflation: { mode: 'flat', flatRatePct: 3.1 },
    });
    expect(describeAssumptions(s)).toContain('2.5% on cash');
    expect(describeAssumptions(s)).toContain('3.1% inflation');
  });

  it('says inflation varies rather than printing a rate that is not being used', () => {
    const s = scenarioWith({ inflation: { mode: 'byYear', byYear: [{ year: 2030, ratePct: 4 }] } });
    expect(describeAssumptions(s)).toContain('inflation varying by year');
    expect(describeAssumptions(s)).not.toMatch(/\d+% inflation/);
  });

  // Indexation ON is both the default and what the tax authorities do, so
  // naming it is noise. OFF is a deliberate stress test that compounds.
  it('mentions frozen tax thresholds only when indexation is off', () => {
    expect(describeAssumptions(scenarioWith({ indexTaxThresholdsToInflation: true }))).not.toContain('frozen');
    expect(describeAssumptions(scenarioWith({ indexTaxThresholdsToInflation: false }))).toContain('tax thresholds frozen');
  });
});
