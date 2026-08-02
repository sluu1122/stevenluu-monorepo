import type { AuditStep } from './types';

export interface GrowthResult {
  newBalance: number;
  growthAmount: number;
  steps: AuditStep[];
}

export function applyGrowth(balance: number, ratePct: number, bucketLabel: string): GrowthResult {
  const growthAmount = balance * (ratePct / 100);
  const newBalance = balance + growthAmount;

  return {
    newBalance,
    growthAmount,
    steps: [
      {
        label: `Growth on ${bucketLabel}`,
        formula: 'balance × ratePct%',
        inputs: { balance, ratePct },
        result: growthAmount,
        relatedFields: ['growth'],
      },
    ],
  };
}
