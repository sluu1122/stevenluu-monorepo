import type { AccountBucket, CashBufferRule } from './schema';
import type { AuditStep } from './types';

export interface ReplenishResult {
  pulledFrom: Record<string, number>;
  amountTransferred: number;
  steps: AuditStep[];
}

/**
 * If the cash bucket is below `targetMonthsOfSpending` worth of spending,
 * pulls the shortfall from `replenishmentOrder` in sequence. A net-worth-
 * neutral internal transfer, not a withdrawal.
 */
export function checkAndReplenish(
  balances: Record<string, number>,
  cashBucketId: string,
  rule: CashBufferRule,
  targetSpending: number,
  buckets: AccountBucket[],
): ReplenishResult {
  const pulledFrom: Record<string, number> = {};
  const steps: AuditStep[] = [];

  if (!rule.enabled) {
    return { pulledFrom, amountTransferred: 0, steps };
  }

  const targetAmount = (rule.targetMonthsOfSpending / 12) * targetSpending;
  const cashBalance = balances[cashBucketId] ?? 0;
  let shortfall = Math.max(0, targetAmount - cashBalance);

  if (shortfall <= 0) {
    return { pulledFrom, amountTransferred: 0, steps };
  }

  for (const sourceId of rule.replenishmentOrder) {
    if (shortfall <= 0) break;
    if (sourceId === cashBucketId) continue;

    const available = balances[sourceId] ?? 0;
    const pull = Math.min(available, shortfall);
    if (pull <= 0) continue;

    pulledFrom[sourceId] = pull;
    const bucket = buckets.find((b) => b.id === sourceId);
    steps.push({
      label: `Replenish cash from ${bucket?.label ?? sourceId}`,
      formula: 'min(bucketBalance, cashShortfall)',
      inputs: { bucketBalance: available, cashShortfall: shortfall },
      result: pull,
      relatedFields: ['cashBufferReplenishment'],
    });
    shortfall -= pull;
  }

  const amountTransferred = Object.values(pulledFrom).reduce((sum, v) => sum + v, 0);
  return { pulledFrom, amountTransferred, steps };
}
