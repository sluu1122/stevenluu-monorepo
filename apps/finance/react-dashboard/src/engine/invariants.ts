import type { AccountBucket } from './schema';
import type { LedgerYearRow } from './types';

/**
 * Balance-sheet integrity checks for a built projection.
 *
 * These are the properties a reader is entitled to assume when auditing the
 * Planning Grid: that each year opens where the last one closed, that every
 * dollar leaving an account is accounted for by a column on the same row, and
 * that no account funds more than it holds. They're separated from the tests
 * so any scenario - a fixture, or one a user exported - can be run through
 * the same checker.
 */
export interface InvariantViolation {
  invariant: string;
  year: number;
  bucketId?: string;
  detail: string;
}

export interface InvariantCheckInput {
  rows: LedgerYearRow[];
  /** The buckets visible in this view - a person's own plus any shared. */
  buckets: AccountBucket[];
  /** Starting balance per bucket id, in the view's display currency. */
  openingBalances: Record<string, number>;
  /**
   * Jointly-held buckets. On a SINGLE person's rows these carry household-level
   * Start/End but only that person's own flows - the other owner's withdrawals
   * and contributions are on their row instead - so per-account conservation
   * and overdraft are undefined here and are checked in the combined view
   * (`combined: true`) where the flows are summed. Continuity still applies:
   * the balance itself is one number every row must agree on.
   */
  sharedBucketIds?: Set<string>;
  /** True when `rows` came from combineLedgers, so every person's flows are present. */
  combined?: boolean;
}

/** Money is compared to the cent; anything larger is a real disagreement, not float noise. */
const EPSILON = 0.01;

export function checkLedgerInvariants({ rows, buckets, openingBalances, sharedBucketIds, combined = false }: InvariantCheckInput): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const add = (invariant: string, year: number, detail: string, bucketId?: string) => violations.push({ invariant, year, bucketId, detail });

  rows.forEach((row, index) => {
    const previous = index > 0 ? rows[index - 1] : null;

    for (const bucket of buckets) {
      const start = row.accountStart[bucket.id] ?? 0;
      const withdrawal = row.withdrawals[bucket.id] ?? 0;
      const contribution = row.contributions[bucket.id] ?? 0;
      const growth = row.growth[bucket.id] ?? 0;
      const end = row.accountEnd[bucket.id] ?? 0;

      // 1. Roll-forward continuity: a year opens exactly where the last closed.
      const expectedStart = previous ? (previous.accountEnd[bucket.id] ?? 0) : (openingBalances[bucket.id] ?? 0);
      if (Math.abs(start - expectedStart) > EPSILON) {
        add('continuity', row.year, `Start ${start.toFixed(2)} != ${previous ? 'prior End' : 'opening balance'} ${expectedStart.toFixed(2)}`, bucket.id);
      }

      // A joint account's flows are split across its owners' rows, so these
      // two only mean something once they've been summed - see sharedBucketIds.
      const flowsAreComplete = combined || !sharedBucketIds?.has(bucket.id);

      // 2. Conservation: the row's own columns explain the whole year.
      const expectedEnd = start - withdrawal + contribution + growth;
      if (flowsAreComplete && Math.abs(end - expectedEnd) > EPSILON) {
        add(
          'conservation',
          row.year,
          `End ${end.toFixed(2)} != Start ${start.toFixed(2)} - Withdrawal ${withdrawal.toFixed(2)} + Contribution ${contribution.toFixed(2)} + Growth ${growth.toFixed(2)} = ${expectedEnd.toFixed(2)}`,
          bucket.id,
        );
      }

      // 3. No overdraft: an account can't fund more than it holds. Contributions
      // count as available because they land before the draw that spends them
      // (a buffer is replenished, then drawn, inside the same year).
      if (flowsAreComplete && withdrawal > start + contribution + EPSILON) {
        add('no-overdraft', row.year, `Withdrawal ${withdrawal.toFixed(2)} exceeds Start ${start.toFixed(2)} + Contribution ${contribution.toFixed(2)}`, bucket.id);
      }

      // 5. Unit consistency: a balance is never negative in a well-formed run,
      // and a sign flip is the cheapest signal that a conversion or a floor
      // went wrong on one side of the year.
      if (end < -EPSILON || start < -EPSILON) {
        add('non-negative', row.year, `Start ${start.toFixed(2)} / End ${end.toFixed(2)} is negative`, bucket.id);
      }
    }

    // 6. Derived totals reconcile.
    const taxSum = row.taxesPaid.federal + row.taxesPaid.stateOrProvincial;
    if (Math.abs(taxSum - row.taxesPaid.total) > EPSILON) {
      add('tax-total', row.year, `federal ${row.taxesPaid.federal} + state ${row.taxesPaid.stateOrProvincial} != total ${row.taxesPaid.total}`);
    }

    const ownedEnd = buckets.reduce((sum, b) => sum + (row.accountEnd[b.id] ?? 0), 0);
    if (row.totalNetWorth > ownedEnd + EPSILON) {
      add('net-worth', row.year, `totalNetWorth ${row.totalNetWorth.toFixed(2)} exceeds the sum of End balances ${ownedEnd.toFixed(2)}`);
    }

    // A meltdown is a withdrawal from a tax-deferred bucket, so the total it
    // reports can never exceed what those buckets actually gave up.
    const taxDeferredWithdrawn = buckets
      .filter((b) => b.taxTreatment === 'taxDeferred')
      .reduce((sum, b) => sum + (row.withdrawals[b.id] ?? 0), 0);
    if (row.meltdownWithdrawalTotal > taxDeferredWithdrawn + EPSILON) {
      add('meltdown-total', row.year, `meltdownWithdrawalTotal ${row.meltdownWithdrawalTotal.toFixed(2)} exceeds tax-deferred withdrawals ${taxDeferredWithdrawn.toFixed(2)}`);
    }
  });

  return violations;
}

/** Formats violations for a test failure message - year, account, and the disagreeing numbers. */
export function formatViolations(violations: InvariantViolation[], limit = 15): string {
  const shown = violations.slice(0, limit).map((v) => `  [${v.invariant}] ${v.year}${v.bucketId ? ` ${v.bucketId}` : ''}: ${v.detail}`);
  const more = violations.length > limit ? `\n  ...and ${violations.length - limit} more` : '';
  return `${violations.length} invariant violation(s):\n${shown.join('\n')}${more}`;
}
