import type { PersonPlan } from './schema';

/**
 * Person 1 is only a default - the person whose plan a view falls back to
 * when nothing has been selected yet. Unlike the previous household model,
 * no calculation is anchored to them: age, retirement timing, spending and
 * tax all come from whichever person's plan is being built.
 */
export function getPrimaryPerson(persons: PersonPlan[]): PersonPlan {
  return persons[0];
}

/**
 * Every person's ledger is projected over this same span - the longest-lived
 * person's horizon - so all persons' rows line up year-for-year and the
 * combined view is a straight row-by-row zip with no alignment logic.
 */
export function getProjectionHorizonEndYear(persons: PersonPlan[]): number {
  return Math.max(...persons.map((p) => p.birthYear + p.planningEndAge));
}
