import { createDefaultPersonPlan, createDefaultScenario, deriveReplenishmentOrder } from './defaults';
import { createBlankAccountBucket } from './accountKindMeta';
import { getDefaultFederalTable } from './taxBrackets';
import { CANADIAN_TAX_TABLES, US_STATE_TAX_TABLES } from './regionalTaxTables';
import type { PersonPlan, Scenario } from './schema';

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Point a person's leftover income at their taxable investment account instead
 * of leaving `surplusDestinationAccountBucketId` null, which banks it all into
 * the cash buffer at cash yields (see `createDefaultPersonPlan`). Every demo
 * person here out-earns their spending by a wide margin, so the default would
 * strand decades of savings in a savings account and make the projections look
 * far worse than the inputs imply.
 *
 * Keyed off the scenario's country rather than whichever taxable bucket comes
 * first in the array: the cross-border person holds both a US brokerage and a
 * CA non-registered account, and a Canadian resident would be contributing to
 * the Canadian one.
 */
function bankSurplusIntoTaxableInvestments(person: PersonPlan, country: 'US' | 'CA'): void {
  const kind = country === 'US' ? 'US_TAXABLE_BROKERAGE' : 'CA_NON_REGISTERED';
  const taxable = person.accountBuckets.find((bucket) => bucket.kind === kind);
  if (!taxable) return;
  person.surplusDestinationAccountBucketId = taxable.id;

  // Drop this account's own scheduled contribution. The surplus is already
  // everything left after spending and tax, so a separate scheduled
  // contribution into the SAME account is the same dollars asked for twice.
  // The engine correctly refuses to fund it (an account can't fund its own
  // contribution, and the default seed leaves no other taxable account to draw
  // on), which produced a contribution notice every projected year.
  taxable.annualContributionWhileWorking = 0;
}

/**
 * Three scenarios exercising the engine's main axes - a single US filer, a
 * married-filing-jointly US couple, and a Canadian couple holding accounts on
 * both sides of the border - so a first-time visitor sees real output instead
 * of an empty "create your first scenario" prompt. Built the same way the
 * engine's own audits were: starting from `createDefaultScenario` and
 * layering realistic overrides on top, rather than hand-rolling fixtures that
 * could drift from what the app itself considers a sane default.
 */
export function createDemoScenarios(): Scenario[] {
  return [createUsSingleDemoScenario(), createUsCoupleDemoScenario(), createCrossBorderCoupleDemoScenario()];
}

function createUsSingleDemoScenario(): Scenario {
  const scenario = createDefaultScenario('US', 'US Single Filer');
  const person = scenario.persons[0];
  person.annualIncomeNominal = 95_000;
  person.incomeGrowthRatePct = 2.5;
  person.retirementStartYear = person.birthYear + 65;
  bankSurplusIntoTaxableInvestments(person, 'US');

  // California, so the demo actually exercises a graduated state bracket walk
  // instead of the no-tax Texas default.
  scenario.taxConfig.stateOrProvincialTable = { ...US_STATE_TAX_TABLES.CA };
  return scenario;
}

function createUsCoupleDemoScenario(): Scenario {
  const scenario = createDefaultScenario('US', 'US Married Couple (MFJ)');

  const person1 = createDefaultPersonPlan('US', 'Person 1');
  person1.annualIncomeNominal = 105_000;
  person1.incomeGrowthRatePct = 2.5;
  person1.retirementStartYear = person1.birthYear + 65;

  const person2 = createDefaultPersonPlan('US', 'Person 2');
  person2.birthYear = CURRENT_YEAR - 33;
  person2.annualIncomeNominal = 85_000;
  person2.incomeGrowthRatePct = 2.5;
  person2.retirementStartYear = person2.birthYear + 65;

  bankSurplusIntoTaxableInvestments(person1, 'US');
  bankSurplusIntoTaxableInvestments(person2, 'US');

  scenario.persons = [person1, person2];
  scenario.householdSpendingRealAtRetirement = 85_000;

  scenario.taxConfig.filingStatus = 'marriedFilingJointly';
  scenario.taxConfig.federalTable = getDefaultFederalTable('US', 'marriedFilingJointly');
  scenario.taxConfig.stateOrProvincialTable = { ...US_STATE_TAX_TABLES.CA };
  return scenario;
}

function createCrossBorderCoupleDemoScenario(): Scenario {
  const scenario = createDefaultScenario('CA', 'Cross-Border Couple (Canada + US Accounts)');
  scenario.taxConfig.stateOrProvincialTable = { ...CANADIAN_TAX_TABLES.ON };

  // Person 1: the sole earner, with legacy US accounts left over from a stint
  // working south of the border, on top of the usual Canadian set. Both
  // countries' account kinds coexist on one person - the engine already keys
  // RMD rules and currency conversion off each account's OWN country, not the
  // scenario's, which is what makes this realistic rather than a hack.
  const person1 = createDefaultPersonPlan('CA', 'Person 1');
  person1.annualIncomeNominal = 120_000;
  person1.incomeGrowthRatePct = 2.5;
  person1.retirementStartYear = person1.birthYear + 65;
  const usBrokerage = { ...createBlankAccountBucket('US_TAXABLE_BROKERAGE'), startingBalance: 80_000 };
  const us401k = { ...createBlankAccountBucket('US_TRADITIONAL_401K_IRA'), startingBalance: 150_000 };
  person1.accountBuckets = [...person1.accountBuckets, usBrokerage, us401k];
  person1.cashBufferRule.replenishmentOrder = deriveReplenishmentOrder(person1.accountBuckets);
  // Contributed to while working in the US; no longer accruing now that the
  // household's income all runs through Person 1's current CA accounts.
  person1.benefits[0].monthlyBenefitAtClaimAge = Math.round(person1.benefits[0].monthlyBenefitAtClaimAge * 0.6);

  // Person 2: no income of their own (single-income household), so much
  // smaller balances and no RRSP room, but a TFSA still accrues regardless of
  // income and CPP/OAS are claimed on their own more modest history.
  const person2 = createDefaultPersonPlan('CA', 'Person 2');
  person2.birthYear = CURRENT_YEAR - 33;
  person2.retirementStartYear = person1.retirementStartYear;
  person2.accountBuckets = person2.accountBuckets.map((bucket) => {
    if (bucket.kind === 'CA_RRSP_RRIF') return { ...bucket, startingBalance: 0, annualContributionWhileWorking: 0 };
    if (bucket.kind === 'CA_TFSA') return { ...bucket, startingBalance: 40_000, annualContributionWhileWorking: 0 };
    if (bucket.kind === 'CA_NON_REGISTERED') return { ...bucket, startingBalance: 20_000, annualContributionWhileWorking: 0 };
    if (bucket.kind === 'CA_CASH_POOL') return { ...bucket, startingBalance: 10_000 };
    return bucket;
  });
  person2.cashBufferRule.replenishmentOrder = deriveReplenishmentOrder(person2.accountBuckets);
  // CPP is earnings-based - a spouse who never worked draws only a token
  // amount; OAS is residency-based and stays at the default full rate.
  person2.benefits = person2.benefits.map((benefit) => (benefit.type === 'CA_CPP' ? { ...benefit, monthlyBenefitAtClaimAge: 150 } : benefit));

  // Person 2 has no income of their own, so no surplus of their own to bank -
  // set anyway so the pair stay consistent if someone gives them an income.
  bankSurplusIntoTaxableInvestments(person1, 'CA');
  bankSurplusIntoTaxableInvestments(person2, 'CA');

  scenario.persons = [person1, person2];
  scenario.householdSpendingRealAtRetirement = 70_000;
  return scenario;
}
