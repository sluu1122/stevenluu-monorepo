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
 * Whole dollars with separators, and no currency symbol: this message is built
 * in the engine, which doesn't know the currency the reader has the app set to
 * display in. "Short 41,283" beats the raw "Shortfall of 41283.44" the reader
 * used to get, and beats guessing at a symbol that might be the wrong one.
 */
const AMOUNT_FORMAT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
function formatAmount(value: number): string {
  return AMOUNT_FORMAT.format(value);
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
    ageBlockedBalance > 0.01 ? ` ${formatAmount(ageBlockedBalance)} is held in accounts not yet available at age ${age}.` : '';
  const warning: EngineWarning | undefined =
    shortfall > 0.01
      ? {
          year,
          kind: 'spendingShortfall',
          code: 'spending.accountsExhausted',
          amount: shortfall,
          message:
            `Short ${formatAmount(shortfall)}: every account available at this age was drawn to zero before the year's spending and tax were covered.${ageNote}` +
            ' Lower spending, retire later, or make an earlier-available account drawable in Withdrawal Order.',
        }
      : undefined;

  return { withdrawals, shortfall, steps, ageBlockedBalance, warning };
}
