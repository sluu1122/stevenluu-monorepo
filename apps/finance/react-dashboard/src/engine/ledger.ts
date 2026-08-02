import type { GridOverride, Person, Scenario } from './schema';
import type { AuditStep, EngineWarning, LedgerResult, LedgerYearRow } from './types';
import { getInflationRateForYear } from './inflation';
import { applyOasClawback, calculateBenefitForYear } from './benefits';
import { calculateTotalTax } from './calculateTax';
import { applyWithdrawal } from './waterfall';
import { checkAndReplenish } from './cashBuffer';
import { applyGrowth } from './growth';
import { calculateMeltdownWithdrawal } from './meltdown';
import { getHouseholdAge, getHouseholdRetirementStartYear, getProjectionHorizonEndYear } from './household';

function findOverride(overrides: GridOverride[], year: number, field: string): GridOverride | undefined {
  return overrides.find((o) => o.year === year && o.field === field);
}

function activeIncomeAmount(source: Scenario['incomeSources'][number], year: number): number {
  if (year < source.startYear) return 0;
  if (source.endYear !== undefined && year > source.endYear) return 0;
  const yearsElapsed = year - source.startYear;
  return source.annualAmountNominal * Math.pow(1 + source.growthRatePct / 100, yearsElapsed);
}

/** A person's income compounds from the projection's start year and stops the year their own retirement begins. */
function activePersonIncome(person: Person, year: number, projectionStartYear: number): number {
  if (person.retirementStartYear !== null && year >= person.retirementStartYear) return 0;
  const yearsElapsed = year - projectionStartYear;
  return person.annualIncomeNominal * Math.pow(1 + person.incomeGrowthRatePct / 100, yearsElapsed);
}

/**
 * Builds the full year-by-year ledger for a scenario. Pure and synchronous -
 * no IO, no async. Every sub-calculation returns { result, steps }, and this
 * orchestrator concatenates those steps into each row's audit trail, so the
 * explanation can never drift out of sync with the math it explains.
 */
export function buildLedger(scenario: Scenario, overrides: GridOverride[]): LedgerResult {
  const rows: LedgerYearRow[] = [];
  const warnings: EngineWarning[] = [];

  const buckets = scenario.accountBuckets;
  const cashBucket = buckets.find((b) => b.isCashBuffer);
  const balances: Record<string, number> = {};
  for (const bucket of buckets) {
    balances[bucket.id] = bucket.startingBalance;
  }

  const startYear = new Date().getFullYear();
  const retirementStartYear = getHouseholdRetirementStartYear(scenario.household);
  const horizonEndYear = getProjectionHorizonEndYear(scenario.household);

  // Catch up the cumulative inflation factor if retirement already started
  // before the projection window begins, so the first row's nominal
  // spending reflects inflation already accrued since retirementStartYear.
  let cumulativeInflationFactor = 1;
  if (retirementStartYear !== null && retirementStartYear < startYear) {
    for (let y = retirementStartYear + 1; y < startYear; y++) {
      cumulativeInflationFactor *= 1 + getInflationRateForYear(scenario.inflation, y);
    }
  }

  // OAS clawback is based on the PRIOR tax year's net income, not the
  // current year's - this is the real CRA mechanism, and it also sidesteps
  // the circularity that computing it from the current year's income (which
  // includes the OAS itself) would create. No prior year exists before the
  // first projected year, so it starts as 0 (a documented v1 simplification -
  // this is a forward-only projection with no pre-scenario income history).
  let previousYearTaxableIncome = 0;

  for (let year = startYear, age = getHouseholdAge(scenario.household, year); year <= horizonEndYear; year++, age++) {
    const audit: AuditStep[] = [];
    const overriddenFields: string[] = [];
    const isRetired = retirementStartYear !== null && year >= retirementStartYear;

    if (isRetired) {
      if (year === retirementStartYear) {
        cumulativeInflationFactor = 1;
      } else {
        cumulativeInflationFactor *= 1 + getInflationRateForYear(scenario.inflation, year);
      }
    }

    // --- Spending (nominal + real) ---
    const plannedNominalSpending = isRetired ? scenario.annualSpendingRealAtRetirement * cumulativeInflationFactor : 0;
    const spendingOverride = findOverride(overrides, year, 'spendingNominal');
    const spendingNominal = spendingOverride ? spendingOverride.value : plannedNominalSpending;
    const spendingReal = isRetired ? spendingNominal / cumulativeInflationFactor : 0;
    if (spendingOverride) overriddenFields.push('spendingNominal');
    audit.push({
      label: 'Nominal spending',
      formula: isRetired ? 'annualSpendingRealAtRetirement × cumulativeInflationFactor' : '0 (not yet retired)',
      inputs: { annualSpendingRealAtRetirement: scenario.annualSpendingRealAtRetirement, cumulativeInflationFactor },
      result: spendingNominal,
      relatedFields: ['spendingNominal', 'spendingReal'],
    });

    // --- Incomes and benefits ---
    const personIncomes = scenario.household.persons.map((person) => ({
      sourceId: person.id,
      amount: activePersonIncome(person, year, startYear),
    }));
    const incomes = [...personIncomes, ...scenario.incomeSources.map((source) => ({ sourceId: source.id, amount: activeIncomeAmount(source, year) }))];
    const totalIncomes = incomes.reduce((sum, i) => sum + i.amount, 0);

    const benefits: { type: string; amount: number }[] = [];
    let totalBenefits = 0;
    for (const benefit of scenario.benefits) {
      // Each household member's benefit claim age resolves against their own
      // birth year, not necessarily the household's reference (Person 1's)
      // age - their timeline is independent even though the accounts they
      // draw from are shared.
      const owner = scenario.household.persons.find((p) => p.id === benefit.personId);
      const personAge = owner ? year - owner.birthYear : age;
      const { amount: grossAmount, steps } = calculateBenefitForYear(benefit, personAge);
      audit.push(...steps);

      let amount = grossAmount;
      if (benefit.type === 'CA_OAS' && grossAmount > 0) {
        const clawbackResult = applyOasClawback(grossAmount, previousYearTaxableIncome);
        amount = clawbackResult.netAmount;
        audit.push(...clawbackResult.steps);
      }

      if (amount > 0) benefits.push({ type: benefit.type, amount });
      totalBenefits += amount;
    }

    // --- Step 1: beginning-of-year withdrawal for the net spending need ---
    const accountStart: Record<string, number> = { ...balances };
    const netSpendingNeed = Math.max(0, spendingNominal - totalIncomes - totalBenefits);
    const spendingWithdrawal = applyWithdrawal(netSpendingNeed, buckets, scenario.waterfall, balances, year);
    audit.push(...spendingWithdrawal.steps);
    if (spendingWithdrawal.warning) warnings.push(spendingWithdrawal.warning);
    for (const [bucketId, amount] of Object.entries(spendingWithdrawal.withdrawals)) {
      balances[bucketId] -= amount;
    }

    // --- Step 2: tax on taxable income, drawn via a second waterfall pass ---
    const taxableWithdrawals = buckets
      .filter((b) => b.taxTreatment === 'taxDeferred')
      .reduce((sum, b) => sum + (spendingWithdrawal.withdrawals[b.id] ?? 0), 0);
    const grossTaxableIncome = taxableWithdrawals + totalIncomes + totalBenefits;
    const taxResult = calculateTotalTax(grossTaxableIncome, scenario.taxConfig);
    audit.push(...taxResult.steps);
    previousYearTaxableIncome = grossTaxableIncome;

    const taxWithdrawal = applyWithdrawal(taxResult.total, buckets, scenario.waterfall, balances, year);
    audit.push(...taxWithdrawal.steps);
    if (taxWithdrawal.warning) warnings.push(taxWithdrawal.warning);
    for (const [bucketId, amount] of Object.entries(taxWithdrawal.withdrawals)) {
      balances[bucketId] -= amount;
    }

    const contributions: Record<string, number> = {};

    // --- Step 2b: optional meltdown - a discretionary extra withdrawal from
    // tax-deferred buckets, beyond the spending need, up to a target taxable-
    // income ceiling within a configured window - taxed at its own
    // incremental rate (two calculateTotalTax calls, same two-pass shape as
    // the spending/tax split above) and the after-tax surplus reinvested
    // into a chosen destination bucket. ---
    const meltdownResult = calculateMeltdownWithdrawal(scenario.meltdownRule, year, grossTaxableIncome, buckets, balances);
    audit.push(...meltdownResult.steps);
    for (const [bucketId, amount] of Object.entries(meltdownResult.withdrawals)) {
      balances[bucketId] -= amount;
    }

    let meltdownTax = { federal: 0, stateOrProvincial: 0, total: 0 };
    const meltdownTaxWithdrawal: Record<string, number> = {};
    if (meltdownResult.totalWithdrawn > 0) {
      const taxWithMeltdown = calculateTotalTax(grossTaxableIncome + meltdownResult.totalWithdrawn, scenario.taxConfig);
      meltdownTax = {
        federal: taxWithMeltdown.federal - taxResult.federal,
        stateOrProvincial: taxWithMeltdown.stateOrProvincial - taxResult.stateOrProvincial,
        total: taxWithMeltdown.total - taxResult.total,
      };
      audit.push({
        label: 'Tax on meltdown withdrawal (incremental)',
        formula: 'calculateTotalTax(grossTaxableIncome + meltdownWithdrawal) - calculateTotalTax(grossTaxableIncome)',
        inputs: { grossTaxableIncome, meltdownWithdrawal: meltdownResult.totalWithdrawn },
        result: meltdownTax.total,
        relatedFields: ['taxesPaid.total'],
      });

      const meltdownTaxDraw = applyWithdrawal(meltdownTax.total, buckets, scenario.waterfall, balances, year);
      audit.push(...meltdownTaxDraw.steps);
      if (meltdownTaxDraw.warning) warnings.push(meltdownTaxDraw.warning);
      for (const [bucketId, amount] of Object.entries(meltdownTaxDraw.withdrawals)) {
        balances[bucketId] -= amount;
        meltdownTaxWithdrawal[bucketId] = (meltdownTaxWithdrawal[bucketId] ?? 0) + amount;
      }

      const destinationId = scenario.meltdownRule?.destinationAccountBucketId;
      const reinvestment = Math.max(0, meltdownResult.totalWithdrawn - meltdownTax.total);
      if (destinationId && reinvestment > 0 && balances[destinationId] !== undefined) {
        balances[destinationId] += reinvestment;
        contributions[destinationId] = (contributions[destinationId] ?? 0) + reinvestment;
        audit.push({
          label: 'Meltdown reinvestment',
          formula: 'meltdownWithdrawal - incrementalTax',
          inputs: { meltdownWithdrawal: meltdownResult.totalWithdrawn, incrementalTax: meltdownTax.total },
          result: reinvestment,
          relatedFields: [`contributions.${destinationId}`],
        });
      }
    }

    const withdrawals: Record<string, number> = {};
    for (const bucket of buckets) {
      const total =
        (spendingWithdrawal.withdrawals[bucket.id] ?? 0) +
        (taxWithdrawal.withdrawals[bucket.id] ?? 0) +
        (meltdownResult.withdrawals[bucket.id] ?? 0) +
        (meltdownTaxWithdrawal[bucket.id] ?? 0);
      if (total > 0) withdrawals[bucket.id] = total;
    }

    // --- Step 3: cash-buffer check/replenishment ---
    let cashBufferReplenishment = 0;
    if (cashBucket) {
      const replenish = checkAndReplenish(balances, cashBucket.id, scenario.cashBufferRule, spendingNominal, buckets);
      audit.push(...replenish.steps);
      for (const [bucketId, amount] of Object.entries(replenish.pulledFrom)) {
        balances[bucketId] -= amount;
      }
      balances[cashBucket.id] += replenish.amountTransferred;
      cashBufferReplenishment = replenish.amountTransferred;
    }

    // --- Step 4: growth ---
    const growth: Record<string, number> = {};
    for (const bucket of buckets) {
      const ratePct = isRetired ? bucket.postRetirementReturnPct : bucket.preRetirementReturnPct;
      const { newBalance, growthAmount, steps } = applyGrowth(balances[bucket.id], ratePct, bucket.label);
      audit.push(...steps);
      balances[bucket.id] = newBalance;
      growth[bucket.id] = growthAmount;
    }

    // --- Step 5: end-of-year contribution (pre-retirement only) ---
    if (!isRetired) {
      for (const bucket of buckets) {
        const amount = bucket.annualContributionWhileWorking ?? 0;
        if (amount > 0) {
          balances[bucket.id] += amount;
          contributions[bucket.id] = (contributions[bucket.id] ?? 0) + amount;
        }
      }
    }

    const accountEnd: Record<string, number> = { ...balances };
    const totalNetWorth = Object.values(accountEnd).reduce((sum, v) => sum + v, 0);

    rows.push({
      year,
      age,
      yearsToOrInRetirement: retirementStartYear !== null ? year - retirementStartYear : Number.NaN,
      isRetired,
      spendingNominal,
      spendingReal,
      incomes,
      benefits,
      accountStart,
      withdrawals,
      contributions,
      growth,
      accountEnd,
      cashBufferReplenishment,
      meltdownWithdrawalTotal: meltdownResult.totalWithdrawn,
      taxesPaid: {
        federal: taxResult.federal + meltdownTax.federal,
        stateOrProvincial: taxResult.stateOrProvincial + meltdownTax.stateOrProvincial,
        total: taxResult.total + meltdownTax.total,
      },
      totalNetWorth,
      overriddenFields,
      audit: { steps: audit },
    });
  }

  return { rows, warnings };
}
