import { createDefaultPersonPlan, createDefaultScenario } from './defaults';
import type { AccountKind, PersonPlan, Scenario } from './schema';

/**
 * A household with money in it, for tests that need one.
 *
 * The engine tests used to call `createDefaultScenario` directly and lean on
 * the balances it happened to seed. That coupled assertions about engine
 * behaviour to a product decision about what a NEW SCENARIO should look like -
 * so emptying that default (a UX change, no engine change at all) turned 21
 * engine tests red for no reason connected to what they were testing.
 *
 * These are the amounts that default used to carry, moved to where they are
 * actually load-bearing. A test wanting a funded household says so; a test
 * wanting the product's real default still calls `createDefaultScenario`.
 */
const FUNDED_AMOUNTS_BY_KIND: Record<AccountKind, { startingBalance: number; annualContributionWhileWorking?: number }> = {
  US_CASH_HYSA: { startingBalance: 30_000 },
  US_TAXABLE_BROKERAGE: { startingBalance: 200_000, annualContributionWhileWorking: 10_000 },
  US_TRADITIONAL_401K_IRA: { startingBalance: 400_000, annualContributionWhileWorking: 24_500 },
  US_ROTH_401K_IRA: { startingBalance: 100_000, annualContributionWhileWorking: 7_500 },
  CA_CASH_POOL: { startingBalance: 30_000 },
  CA_NON_REGISTERED: { startingBalance: 200_000, annualContributionWhileWorking: 10_000 },
  CA_RRSP_RRIF: { startingBalance: 400_000, annualContributionWhileWorking: 32_490 },
  CA_TFSA: { startingBalance: 100_000, annualContributionWhileWorking: 7_000 },
};

/**
 * Assigns in place, and deliberately does NOT write the contribution key when
 * the kind has no contribution - the cash kinds carried `undefined` rather
 * than 0, and the two are distinguishable downstream.
 */
function fund(person: PersonPlan): PersonPlan {
  for (const bucket of person.accountBuckets) {
    const amounts = FUNDED_AMOUNTS_BY_KIND[bucket.kind];
    if (!amounts) continue;
    bucket.startingBalance = amounts.startingBalance;
    if (amounts.annualContributionWhileWorking !== undefined) {
      bucket.annualContributionWhileWorking = amounts.annualContributionWhileWorking;
    }
  }
  return person;
}

/** One person, their country's four account kinds, funded. */
export function createFundedPersonPlan(country: 'US' | 'CA', label: string): PersonPlan {
  return fund(createDefaultPersonPlan(country, label));
}

/** A one-person scenario whose accounts hold money. */
export function createFundedScenario(country: 'US' | 'CA', name?: string): Scenario {
  const scenario = createDefaultScenario(country, name);
  scenario.persons.forEach(fund);
  return scenario;
}
