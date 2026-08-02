import { applyWithdrawal } from './waterfall';
import type { AccountBucket, MeltdownRule } from './schema';
import type { AuditStep } from './types';

export interface MeltdownResult {
  withdrawals: Record<string, number>;
  totalWithdrawn: number;
  steps: AuditStep[];
}

/**
 * Discretionary extra withdrawal from tax-deferred buckets, beyond the
 * spending need, up to a target taxable-income ceiling, within a configured
 * year window (e.g. the gap between retirement and RRIF/RMD age). Reuses
 * applyWithdrawal's exact drawdown mechanics via a synthetic waterfall built
 * from the rule's chosen source buckets, rather than duplicating that logic.
 * A shortfall here (not enough balance to reach the target) isn't a real
 * financial problem - unlike a spending shortfall - so it's silently capped
 * rather than surfaced as an EngineWarning.
 */
export function calculateMeltdownWithdrawal(
  rule: MeltdownRule | undefined,
  year: number,
  taxableIncomeSoFar: number,
  buckets: AccountBucket[],
  balances: Record<string, number>,
): MeltdownResult {
  const empty: MeltdownResult = { withdrawals: {}, totalWithdrawn: 0, steps: [] };
  if (!rule || !rule.enabled) return empty;
  if (rule.startYear !== null && year < rule.startYear) return empty;
  if (rule.endYear !== null && year > rule.endYear) return empty;

  const room = Math.max(0, rule.targetTaxableIncomeCeiling - taxableIncomeSoFar);
  if (room <= 0) return empty;

  const syntheticWaterfall = rule.sourceAccountBucketIds.map((accountBucketId, order) => ({ order, accountBucketId }));
  const result = applyWithdrawal(room, buckets, syntheticWaterfall, balances, year);
  const totalWithdrawn = Object.values(result.withdrawals).reduce((sum, v) => sum + v, 0);
  if (totalWithdrawn <= 0) return empty;

  return {
    withdrawals: result.withdrawals,
    totalWithdrawn,
    steps: [
      {
        label: 'Meltdown withdrawal (fill to target taxable income)',
        formula: 'max(0, targetTaxableIncomeCeiling - taxableIncomeSoFar), capped by available balance',
        inputs: { targetTaxableIncomeCeiling: rule.targetTaxableIncomeCeiling, taxableIncomeSoFar, room },
        result: totalWithdrawn,
        relatedFields: ['meltdownWithdrawalTotal'],
      },
      ...result.steps,
    ],
  };
}
