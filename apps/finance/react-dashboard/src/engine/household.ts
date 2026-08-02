import type { Household, Person } from './schema';

/**
 * Person 1 is the household's reference point for age/retirement-timing
 * purposes (the grid's Age column, the household spending/withdrawal
 * trigger, etc.) - centralized here rather than every consumer
 * independently indexing household.persons[0].
 */
export function getPrimaryPerson(household: Household): Person {
  return household.persons[0];
}

export function getHouseholdRetirementStartYear(household: Household): number | null {
  return getPrimaryPerson(household).retirementStartYear;
}

export function getHouseholdAge(household: Household, year: number): number {
  return year - getPrimaryPerson(household).birthYear;
}

/** The plan projects far enough to cover whichever person lives longest, not just Person 1. */
export function getProjectionHorizonEndYear(household: Household): number {
  return Math.max(...household.persons.map((p) => p.birthYear + p.planningEndAge));
}
