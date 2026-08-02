import type { BenefitConfig } from './schema';
import type { AuditStep } from './types';

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
