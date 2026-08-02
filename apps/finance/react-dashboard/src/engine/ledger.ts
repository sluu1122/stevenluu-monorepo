import type { GridOverride, Scenario } from './schema';
import type { AuditStep, EngineWarning, LedgerResult, LedgerYearRow } from './types';
import { getInflationRateForYear } from './inflation';
import { calculateBenefitForYear } from './benefits';
import { calculateTotalTax } from './calculateTax';
import { applyWithdrawal } from './waterfall';
import { checkAndReplenish } from './cashBuffer';
import { applyGrowth } from './growth';

function findOverride(overrides: GridOverride[], year: number, field: string): GridOverride | undefined {
  return overrides.find((o) => o.year === year && o.field === field);
}

function activeIncomeAmount(source: Scenario['incomeSources'][number], year: number): number {
  if (year < source.startYear) return 0;
  if (source.endYear !== undefined && year > source.endYear) return 0;
  const yearsElapsed = year - source.startYear;
  return source.annualAmountNominal * Math.pow(1 + source.growthRatePct / 100, yearsElapsed);
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
  const retirementStartYear = scenario.retirementStartYear;

  // Catch up the cumulative inflation factor if retirement already started
  // before the projection window begins, so the first row's nominal
  // spending reflects inflation already accrued since retirementStartYear.
  let cumulativeInflationFactor = 1;
  if (retirementStartYear !== null && retirementStartYear < startYear) {
    for (let y = retirementStartYear + 1; y < startYear; y++) {
      cumulativeInflationFactor *= 1 + getInflationRateForYear(scenario.inflation, y);
    }
  }

  for (let year = startYear, age = year - scenario.birthYear; age <= scenario.planningEndAge; year++, age++) {
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
    const incomes = scenario.incomeSources.map((source) => ({
      sourceId: source.id,
      amount: activeIncomeAmount(source, year),
    }));
    const totalIncomes = incomes.reduce((sum, i) => sum + i.amount, 0);

    const benefits: { type: string; amount: number }[] = [];
    let totalBenefits = 0;
    for (const benefit of scenario.benefits) {
      const { amount, steps } = calculateBenefitForYear(benefit, age);
      if (amount > 0) benefits.push({ type: benefit.type, amount });
      totalBenefits += amount;
      audit.push(...steps);
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

    const taxWithdrawal = applyWithdrawal(taxResult.total, buckets, scenario.waterfall, balances, year);
    audit.push(...taxWithdrawal.steps);
    if (taxWithdrawal.warning) warnings.push(taxWithdrawal.warning);
    for (const [bucketId, amount] of Object.entries(taxWithdrawal.withdrawals)) {
      balances[bucketId] -= amount;
    }

    const withdrawals: Record<string, number> = {};
    for (const bucket of buckets) {
      const total = (spendingWithdrawal.withdrawals[bucket.id] ?? 0) + (taxWithdrawal.withdrawals[bucket.id] ?? 0);
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
    const contributions: Record<string, number> = {};
    if (!isRetired) {
      for (const bucket of buckets) {
        const amount = bucket.annualContributionWhileWorking ?? 0;
        if (amount > 0) {
          balances[bucket.id] += amount;
          contributions[bucket.id] = amount;
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
      meltdownWithdrawalTotal: 0,
      taxesPaid: { federal: taxResult.federal, stateOrProvincial: taxResult.stateOrProvincial, total: taxResult.total },
      totalNetWorth,
      overriddenFields,
      audit: { steps: audit },
    });
  }

  return { rows, warnings };
}
