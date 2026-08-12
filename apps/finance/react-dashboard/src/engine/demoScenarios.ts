import { createDefaultPersonPlan, createDefaultScenario, deriveReplenishmentOrder } from './defaults';
import { createBlankAccountBucket } from './accountKindMeta';
import { getDefaultFederalTable } from './taxBrackets';
import { CANADIAN_TAX_TABLES, US_STATE_TAX_TABLES } from './regionalTaxTables';
import type { AccountKind, PersonPlan, Scenario } from './schema';

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Point a person's leftover income at their taxable investment account instead
 * of leaving `surplusDestinationAccountBucketId` null, which banks it all into
 * the cash buffer at cash yields (see `createDefaultPersonPlan`).
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

/** Overwrites seeded starting balances, so each persona reads as a table of figures. */
function setBalances(person: PersonPlan, byKind: Partial<Record<AccountKind, number>>): void {
  for (const bucket of person.accountBuckets) {
    const amount = byKind[bucket.kind];
    if (amount !== undefined) bucket.startingBalance = amount;
  }
}

/** Same, for what goes in each year while working. */
function setContributions(person: PersonPlan, byKind: Partial<Record<AccountKind, number>>): void {
  for (const bucket of person.accountBuckets) {
    const amount = byKind[bucket.kind];
    if (amount !== undefined) bucket.annualContributionWhileWorking = amount;
  }
}

/**
 * Three scenarios exercising the engine's main axes - a single US filer, a
 * married-filing-jointly US couple, and a Canadian couple holding accounts on
 * both sides of the border - so a first-time visitor sees real output instead
 * of an empty "create your first scenario" prompt. Built the same way the
 * engine's own audits were: starting from `createDefaultScenario` and layering
 * realistic overrides on top, rather than hand-rolling fixtures that could
 * drift from what the app itself considers a sane default.
 *
 * Every figure below is chosen against one hard constraint, since the engine
 * funds contributions out of what the household already holds rather than out
 * of the current year's paycheque:
 *
 *     income - spending - tax  >=  contributions
 *
 * Break it and the plan starts emitting "contributions couldn't be funded"
 * every projected year. `SEED_AMOUNTS_BY_KIND` in defaults.ts is deliberately
 * left alone - it seeds user-created scenarios, whose surplus lands in cash
 * and so funds contributions without this constraint biting.
 *
 * The three deliberately differ in shape rather than just in size: one spends
 * less in retirement and leaves a legacy, one spends the same throughout, and
 * one spends more and draws itself down.
 */
export function createDemoScenarios(): Scenario[] {
  return [createUsSingleDemoScenario(), createUsCoupleDemoScenario(), createCrossBorderCoupleDemoScenario()];
}

/**
 * Spends LESS in retirement than while working (~80% replacement - no commute,
 * no saving out of income), and so ends with a clear legacy still compounding.
 */
function createUsSingleDemoScenario(): Scenario {
  const scenario = createDefaultScenario('US', 'US Single Filer');
  const person = scenario.persons[0];
  person.annualIncomeNominal = 95_000;
  person.incomeGrowthRatePct = 2.5;
  person.retirementStartYear = person.birthYear + 65;

  // ~1.8x income at 35 - a diligent saver, not an heir. Cash sits at roughly
  // six months of spending so the buffer starts at its own target instead of
  // pulling a visible top-up out of investments in year one.
  setBalances(person, {
    US_CASH_HYSA: 26_000,
    US_TAXABLE_BROKERAGE: 35_000,
    US_TRADITIONAL_401K_IRA: 85_000,
    US_ROTH_401K_IRA: 25_000,
  });
  setContributions(person, {
    US_TRADITIONAL_401K_IRA: 12_000,
    US_ROTH_401K_IRA: 5_000,
  });

  // Saves ~27% of gross - a frugal, disciplined single earner. Combined with
  // the drop at retirement this draws only ~2% a year, so the portfolio keeps
  // growing in real terms and leaves a substantial legacy at 95.
  scenario.householdSpendingRealBeforeRetirement = 52_000;
  scenario.householdSpendingRealAtRetirement = 42_000;

  bankSurplusIntoTaxableInvestments(person, 'US');

  // California, so the demo actually exercises a graduated state bracket walk
  // instead of the no-tax Texas default.
  scenario.taxConfig.stateOrProvincialTable = { ...US_STATE_TAX_TABLES.CA };
  return scenario;
}

/** Spends the SAME before and after retiring, and lands somewhere in between. */
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

  // Held even between them: two mid-thirties earners on comparable salaries.
  // Each carries half the household's six-month cash buffer.
  for (const person of [person1, person2]) {
    setBalances(person, {
      US_CASH_HYSA: 30_000,
      US_TAXABLE_BROKERAGE: 30_000,
      US_TRADITIONAL_401K_IRA: 70_000,
      US_ROTH_401K_IRA: 25_000,
    });
    setContributions(person, {
      US_TRADITIONAL_401K_IRA: 8_000,
      US_ROTH_401K_IRA: 3_000,
    });
    bankSurplusIntoTaxableInvestments(person, 'US');
  }

  scenario.persons = [person1, person2];
  // Spends the same either side of retiring, on a ~16% savings rate. Lands
  // between the other two: still growing in real terms, but far less steeply
  // than the single filer.
  scenario.householdSpendingRealBeforeRetirement = 120_000;
  scenario.householdSpendingRealAtRetirement = 120_000;

  scenario.taxConfig.filingStatus = 'marriedFilingJointly';
  scenario.taxConfig.federalTable = getDefaultFederalTable('US', 'marriedFilingJointly');
  scenario.taxConfig.stateOrProvincialTable = { ...US_STATE_TAX_TABLES.CA };
  return scenario;
}

/**
 * Spends MORE in retirement than while working - an active early retirement,
 * funded by a single income - and so is the one that visibly draws itself down.
 */
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
  person1.accountBuckets = [...person1.accountBuckets, createBlankAccountBucket('US_TAXABLE_BROKERAGE'), createBlankAccountBucket('US_TRADITIONAL_401K_IRA')];
  setBalances(person1, {
    CA_CASH_POOL: 42_000,
    CA_NON_REGISTERED: 30_000,
    CA_RRSP_RRIF: 80_000,
    CA_TFSA: 30_000,
    // The legacy US side, no longer contributed to now that the household's
    // income all runs through Person 1's current CA accounts.
    US_TAXABLE_BROKERAGE: 25_000,
    US_TRADITIONAL_401K_IRA: 40_000,
  });
  setContributions(person1, {
    CA_RRSP_RRIF: 4_000,
    CA_TFSA: 2_000,
    US_TAXABLE_BROKERAGE: 0,
    US_TRADITIONAL_401K_IRA: 0,
  });
  person1.cashBufferRule.replenishmentOrder = deriveReplenishmentOrder(person1.accountBuckets);
  person1.benefits[0].monthlyBenefitAtClaimAge = Math.round(person1.benefits[0].monthlyBenefitAtClaimAge * 0.6);

  // Person 2: no income of their own (single-income household), so much
  // smaller balances and no RRSP room, but a TFSA still accrues regardless of
  // income and CPP/OAS are claimed on their own more modest history.
  const person2 = createDefaultPersonPlan('CA', 'Person 2');
  person2.birthYear = CURRENT_YEAR - 33;
  person2.retirementStartYear = person1.retirementStartYear;
  setBalances(person2, {
    CA_CASH_POOL: 0,
    CA_NON_REGISTERED: 12_000,
    CA_RRSP_RRIF: 0,
    CA_TFSA: 25_000,
  });
  setContributions(person2, {
    CA_NON_REGISTERED: 0,
    CA_RRSP_RRIF: 0,
    CA_TFSA: 0,
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
  // A single income supporting two people saves little (~8% of gross), then
  // spends MORE once retired - the travel-heavy early retirement. That combination
  // is what makes this the one plan that visibly draws itself down: it starts
  // retirement drawing ~7% a year, well above what the portfolio earns in real
  // terms, so it ends at roughly three quarters of its real peak.
  scenario.householdSpendingRealBeforeRetirement = 84_000;
  scenario.householdSpendingRealAtRetirement = 96_000;
  return scenario;
}
