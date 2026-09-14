import { indexedContributionAmount } from './accountKindMeta';
import { US_CONTRIBUTION_LIMITS_2026 } from './benefitDefaults';
import type { AccountBucket, PersonPlan } from './schema';

/**
 * The most a person could legally defer into US registered accounts in one
 * year, used to flag a plan that contributes more than the law allows.
 *
 * WHY ONLY THE US SIDE IS CHECKED
 *
 * 401(k) elective deferrals and IRA contributions are strictly annual: unused
 * room is gone at year end, so contributing more than the year's limit is
 * always wrong and always worth saying.
 *
 * RRSP and TFSA room is the opposite - unused room carries forward
 * indefinitely, and using it up is ordinary, sensible behaviour. Someone who
 * has never opened a TFSA can legally put in well over a hundred thousand in
 * their first year. Checking a Canadian contribution against one year's limit
 * would therefore fire on plans that are entirely correct, and a warning that
 * cries wolf on correct input is worse than no warning: it teaches people to
 * ignore the ones that matter. Catching those properly needs carried-forward
 * room modelled per person, which this engine does not track.
 *
 * WHY ONE COMBINED CEILING
 *
 * The schema merges 401(k) and IRA into a single account kind, so a bucket
 * labelled "Traditional 401(k)/IRA" could be either. The ceiling is therefore
 * the sum of BOTH vehicles' limits - the most anyone could put across the two -
 * which under-reports (a pure-IRA saver could exceed the IRA limit alone and
 * not trip this) but never fires on a legal plan. For a warning, that is the
 * right direction to be wrong in.
 *
 * Traditional and Roth share the same statutory limits rather than each having
 * their own, so both kinds count against this one ceiling.
 */
const US_REGISTERED_KINDS = ['US_TRADITIONAL_401K_IRA', 'US_ROTH_401K_IRA'] as const;

/** SECURE 2.0's higher "super catch-up" applies for the years someone is 60 to 63, and reverts at 64. */
function catchUpFor(age: number): number {
  const { the401kCatchUp50Plus, the401kCatchUp60To63, iraCatchUp50Plus } = US_CONTRIBUTION_LIMITS_2026;
  if (age < 50) return 0;
  const the401k = age >= 60 && age <= 63 ? the401kCatchUp60To63 : the401kCatchUp50Plus;
  return the401k + iraCatchUp50Plus;
}

/**
 * The ceiling in USD for a person of this age, indexed to the projection year.
 *
 * Indexed because the statutory limits are: left flat, every long projection
 * would trip this warning around year twenty purely because the contribution
 * indexed and the limit didn't.
 *
 * Indexed SMOOTHLY, while the real limits step in $500 and $100 increments and
 * sit flat between steps, so this is an approximation that runs a little ahead
 * of the statute mid-cycle and a little behind just after a step. It is not
 * rounded to a step here because the components don't share one - the 401(k)
 * limit moves in $500s, the IRA catch-up in $100s, and the 60-to-63 catch-up is
 * 11,250 - so snapping their SUM to any single step would distort the exact
 * figure at the same time as it smoothed the indexed one. The warning this
 * feeds is for clear breaches (a five-figure contribution to a 401(k)), where a
 * few hundred dollars of drift in the threshold changes nothing.
 */
export function usAnnualContributionCeiling(age: number, indexationFactor: number): number {
  const base = US_CONTRIBUTION_LIMITS_2026.the401kEmployeeLimit + US_CONTRIBUTION_LIMITS_2026.iraLimit + catchUpFor(age);
  return base * indexationFactor;
}

/**
 * How much over the ceiling this person's scheduled US registered
 * contributions are this year, or 0 when they are within it.
 *
 * Compared in USD, before any conversion to the scenario's display currency: a
 * legislated limit is a native-currency figure, and the accounts it governs are
 * USD by definition, so converting both sides would only add exchange-rate
 * noise to a statutory comparison.
 */
export function usContributionExcess(
  person: PersonPlan,
  age: number,
  isRetired: boolean,
  indexationFactor: number,
): { excess: number; contributed: number; ceiling: number } {
  const contributed = person.accountBuckets.reduce((sum, bucket: AccountBucket) => {
    if (!US_REGISTERED_KINDS.includes(bucket.kind as (typeof US_REGISTERED_KINDS)[number])) return sum;
    // The same gate Phase 4 applies, so this can never describe a contribution
    // the engine will not even attempt to make.
    if (isRetired && !bucket.contributeInRetirement) return sum;
    return sum + indexedContributionAmount(bucket, indexationFactor);
  }, 0);

  const ceiling = usAnnualContributionCeiling(age, indexationFactor);
  return { excess: Math.max(0, contributed - ceiling), contributed, ceiling };
}
