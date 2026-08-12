import { isBucketAvailableAtAge, type AccountAvailabilityAges } from './accountKindMeta';
import type { AccountBucket, WaterfallRule } from './schema';
import type { AuditStep, EngineWarning } from './types';

export interface WithdrawalResult {
  withdrawals: Record<string, number>;
  shortfall: number;
  steps: AuditStep[];
  /** Balance sitting in accounts the drawer is too young to reach - explains an otherwise puzzling shortfall. */
  ageBlockedBalance: number;
  warning?: EngineWarning;
}

/**
 * Draws `amountNeeded` from buckets in waterfall order; records a shortfall
 * warning rather than throwing if exhausted.
 *
 * Buckets the drawer is too young to reach (see `availableFromAge`) are
 * skipped entirely and the draw falls through to the next one. `age` is the
 * age of the person doing the drawing.
 */
export function applyWithdrawal(
  amountNeeded: number,
  buckets: AccountBucket[],
  waterfall: WaterfallRule,
  balances: Record<string, number>,
  year: number,
  age: number,
  availabilityAges?: AccountAvailabilityAges,
): WithdrawalResult {
  const withdrawals: Record<string, number> = {};
  const steps: AuditStep[] = [];
  let remaining = Math.max(0, amountNeeded);
  let ageBlockedBalance = 0;

  const orderedIds = [...waterfall].sort((a, b) => a.order - b.order).map((w) => w.accountBucketId);

  for (const bucketId of orderedIds) {
    if (remaining <= 0) break;
    const available = balances[bucketId] ?? 0;

    const bucketMeta = buckets.find((b) => b.id === bucketId);
    if (bucketMeta && !isBucketAvailableAtAge(bucketMeta, age, availabilityAges)) {
      ageBlockedBalance += Math.max(0, available);
      continue;
    }

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
  // A shortfall while money sits in age-gated accounts looks like the plan is
  // simply broke, so say which it is.
  const ageNote =
    ageBlockedBalance > 0.01 ? ` ${ageBlockedBalance.toFixed(2)} is held in accounts not yet available at age ${age}.` : '';
  const warning: EngineWarning | undefined =
    shortfall > 0.01
      ? { year, kind: 'spendingShortfall', code: 'spending.accountsExhausted', amount: shortfall, message: `Shortfall of ${shortfall.toFixed(2)}: all available account buckets exhausted before the spending/tax need was met.${ageNote}` }
      : undefined;

  return { withdrawals, shortfall, steps, ageBlockedBalance, warning };
}
