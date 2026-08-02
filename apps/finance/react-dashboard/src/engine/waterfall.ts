import type { AccountBucket, WaterfallRule } from './schema';
import type { AuditStep, EngineWarning } from './types';

export interface WithdrawalResult {
  withdrawals: Record<string, number>;
  shortfall: number;
  steps: AuditStep[];
  warning?: EngineWarning;
}

/** Draws `amountNeeded` from buckets in waterfall order; records a shortfall warning rather than throwing if exhausted. */
export function applyWithdrawal(
  amountNeeded: number,
  buckets: AccountBucket[],
  waterfall: WaterfallRule,
  balances: Record<string, number>,
  year: number,
): WithdrawalResult {
  const withdrawals: Record<string, number> = {};
  const steps: AuditStep[] = [];
  let remaining = Math.max(0, amountNeeded);

  const orderedIds = [...waterfall].sort((a, b) => a.order - b.order).map((w) => w.accountBucketId);

  for (const bucketId of orderedIds) {
    if (remaining <= 0) break;
    const available = balances[bucketId] ?? 0;
    const draw = Math.min(available, remaining);
    if (draw <= 0) continue;

    withdrawals[bucketId] = (withdrawals[bucketId] ?? 0) + draw;
    const bucket = buckets.find((b) => b.id === bucketId);
    steps.push({
      label: `Withdraw from ${bucket?.label ?? bucketId}`,
      formula: 'min(bucketBalance, remainingNeed)',
      inputs: { bucketBalance: available, remainingNeed: remaining },
      result: draw,
      relatedFields: [`withdrawals.${bucketId}`],
    });
    remaining -= draw;
  }

  const shortfall = Math.max(0, remaining);
  const warning: EngineWarning | undefined =
    shortfall > 0.01
      ? { year, message: `Shortfall of ${shortfall.toFixed(2)}: all account buckets exhausted before the spending/tax need was met.` }
      : undefined;

  return { withdrawals, shortfall, steps, warning };
}
