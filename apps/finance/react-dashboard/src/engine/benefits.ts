import type { BenefitConfig } from './schema';
import type { AuditStep } from './types';
import { OAS_CLAWBACK_RATE, OAS_CLAWBACK_THRESHOLD_2025 } from './benefitDefaults';

export interface BenefitCalcResult {
  amount: number;
  steps: AuditStep[];
}

/** Zero before claim age; COLA-compounded annually from claim age onward. */
export function calculateBenefitForYear(benefit: BenefitConfig, age: number): BenefitCalcResult {
  if (age < benefit.claimAge) {
    return { amount: 0, steps: [] };
  }

  const yearsSinceClaim = age - benefit.claimAge;
  const annualAtClaim = benefit.monthlyBenefitAtClaimAge * 12;
  const amount = annualAtClaim * Math.pow(1 + benefit.colaPct / 100, yearsSinceClaim);

  return {
    amount,
    steps: [
      {
        label: `${benefit.type} benefit`,
        formula: 'monthlyBenefitAtClaimAge × 12 × (1 + colaPct%)^yearsSinceClaim',
        inputs: {
          monthlyBenefitAtClaimAge: benefit.monthlyBenefitAtClaimAge,
          colaPct: benefit.colaPct,
          yearsSinceClaim,
        },
        result: amount,
        relatedFields: ['benefits'],
      },
    ],
  };
}

export interface OasClawbackResult {
  netAmount: number;
  clawback: number;
  steps: AuditStep[];
}

/**
 * OAS recovery tax: 15% of the PRIOR tax year's net income above the
 * threshold, capped at the full gross benefit. This is the actual CRA
 * mechanism (not an approximation of it) - clawback is genuinely based on
 * the prior year's return, which conveniently also sidesteps the circularity
 * that computing it from the current year's income (which itself includes
 * this benefit) would create.
 *
 * `threshold` is passed in rather than read from the constant because the CRA
 * indexes it annually; frozen at its 2025 figure across a long projection it
 * would claw back the whole benefit on the strength of inflation alone.
 */
export function applyOasClawback(grossAmount: number, previousYearTaxableIncome: number, threshold: number = OAS_CLAWBACK_THRESHOLD_2025): OasClawbackResult {
  const excessIncome = Math.max(0, previousYearTaxableIncome - threshold);
  const clawback = Math.min(grossAmount, excessIncome * OAS_CLAWBACK_RATE);
  const netAmount = grossAmount - clawback;

  if (clawback <= 0) {
    return { netAmount, clawback: 0, steps: [] };
  }

  return {
    netAmount,
    clawback,
    steps: [
      {
        label: 'OAS recovery tax (clawback)',
        formula: 'min(grossAmount, max(0, priorYearTaxableIncome - threshold) × 15%)',
        inputs: { grossAmount, previousYearTaxableIncome, threshold },
        result: clawback,
        relatedFields: ['benefits'],
      },
    ],
  };
}
