import { applyWithdrawal } from './waterfall';
import type { AccountAvailabilityAges } from './accountKindMeta';
import type { AccountBucket, MeltdownRule } from './schema';
import type { AuditStep } from './types';

export interface MeltdownResult {
  withdrawals: Record<string, number>;
  totalWithdrawn: number;
  steps: AuditStep[];
}

/**
 * Discretionary extra withdrawal from one tax-deferred bucket, beyond the
 * spending need, up to a target taxable-income ceiling, within a configured
 * year window (e.g. the gap between retirement and RRIF/RMD age). Reuses
 * applyWithdrawal's exact drawdown mechanics via a one-step synthetic
 * waterfall rather than duplicating that logic.
 *
 * `taxableIncomeSoFar` must already include any earlier meltdown rule's
 * withdrawal for the same year - two rules sharing a $60k ceiling have to
 * fill to $60k together, not $60k each. The ledger threads that running
 * total through in rule order.
 *
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
  age: number,
  availabilityAges?: AccountAvailabilityAges,
): MeltdownResult {
  const empty: MeltdownResult = { withdrawals: {}, totalWithdrawn: 0, steps: [] };
  if (!rule || !rule.enabled) return empty;
  if (rule.startYear !== null && year < rule.startYear) return empty;
  if (rule.endYear !== null && year > rule.endYear) return empty;

  const room = Math.max(0, rule.targetTaxableIncomeCeiling - taxableIncomeSoFar);
  if (room <= 0) return empty;

  // Age-gated too: you can't melt down a 401(k) before you can legally touch it.
  const result = applyWithdrawal(room, buckets, [{ order: 0, accountBucketId: rule.accountBucketId }], balances, year, age, availabilityAges);
  const totalWithdrawn = Object.values(result.withdrawals).reduce((sum, v) => sum + v, 0);
  if (totalWithdrawn <= 0) return empty;

  const sourceLabel = buckets.find((b) => b.id === rule.accountBucketId)?.label ?? rule.accountBucketId;

  return {
    withdrawals: result.withdrawals,
    totalWithdrawn,
    steps: [
      {
        label: `Meltdown withdrawal - ${sourceLabel} (fill to target taxable income)`,
        formula: 'max(0, targetTaxableIncomeCeiling - taxableIncomeSoFar), capped by available balance',
        inputs: { targetTaxableIncomeCeiling: rule.targetTaxableIncomeCeiling, taxableIncomeSoFar, room },
        result: totalWithdrawn,
        relatedFields: ['meltdownWithdrawalTotal'],
      },
      ...result.steps,
    ],
  };
}
