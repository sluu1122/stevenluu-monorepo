import type { AuditStep } from './types';

export interface GrowthResult {
  newBalance: number;
  growthAmount: number;
  steps: AuditStep[];
}

/**
 * Grows `balance` by `ratePct`.
 *
 * `growthBase` defaults to `balance` - the two differ only for a cash buffer,
 * whose interest is earned on the balance it opened the year with rather than
 * on whatever it holds after the year's flows. That keeps the interest equal
 * to the amount already taxed as ordinary income and credited to cost basis in
 * "Phase 0b", which is computed on the same opening balance. Growing the
 * post-flow balance instead left the difference sitting in the account taxed
 * as nothing, which later surfaced as a capital gain on a cash sale.
 */
export function applyGrowth(balance: number, ratePct: number, bucketLabel: string, growthBase: number = balance): GrowthResult {
  const growthAmount = growthBase * (ratePct / 100);
  const newBalance = balance + growthAmount;

  return {
    newBalance,
    growthAmount,
    steps: [
      {
        label: `Growth on ${bucketLabel}`,
        formula: 'balance × ratePct%',
        inputs: { balance: growthBase, ratePct },
        result: growthAmount,
        relatedFields: ['growth'],
      },
    ],
  };
}
