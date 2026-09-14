import type { Scenario } from '../engine/schema';

/**
 * The handful of assumptions every projected figure rests on, in one line.
 *
 * These live on the Scenario Setup tab, which is exactly where nobody is
 * looking while reading the output. A plan that ends at four million means
 * something quite different at 7% than at 4%, and the reader had no way to
 * tell which one they were looking at without leaving the page - so the
 * headline number carried no provenance at all.
 *
 * Deliberately short. It is a caption under the figures, not a settings
 * summary; anything longer stops being read.
 */
export function describeAssumptions(scenario: Scenario): string {
  const { investmentsPreRetirementPct: pre, investmentsPostRetirementPct: post, cashPct } = scenario.returnRates;

  // One number while the two rates agree, since "7% before and 7% after" reads
  // as a setting the user chose separately when it usually isn't.
  const growth = pre === post ? `${pre}% returns` : `${pre}% returns before retirement, ${post}% after`;

  const inflation =
    scenario.inflation.mode === 'flat' ? `${scenario.inflation.flatRatePct ?? 0}% inflation` : 'inflation varying by year';

  const parts = [growth, `${cashPct}% on cash`, inflation];
  // Only worth saying when it is OFF: indexation on is both the default and
  // what the CRA and IRS actually do, so naming it adds noise. Off is a
  // deliberate stress test whose effect compounds quietly over decades.
  if (!scenario.indexTaxThresholdsToInflation) parts.push('tax thresholds frozen');

  return parts.join(' · ');
}
