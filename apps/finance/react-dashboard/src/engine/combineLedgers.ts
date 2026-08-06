import type { AccountBucket } from './schema';
import type { EngineWarning, LedgerResult, LedgerYearRow } from './types';
import type { PersonLedger } from './ledger';

export type { PersonLedger };

/**
 * Balance records (accountStart/accountEnd). A shared bucket appears on EVERY
 * person's row carrying the same balance, so these are deduped by assignment -
 * summing would multiply a joint account by the number of people.
 */
function mergeBalanceRecords(records: Record<string, number>[]): Record<string, number> {
  return Object.assign({}, ...records);
}

/**
 * Flow records (withdrawals/contributions). Two people can each draw from or
 * pay into the SAME shared bucket in one year, so these must add up - an
 * assignment merge would silently report only the last person's amount.
 */
function mergeFlowRecords(records: Record<string, number>[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const record of records) {
    for (const [bucketId, amount] of Object.entries(record)) {
      out[bucketId] = (out[bucketId] ?? 0) + amount;
    }
  }
  return out;
}

/**
 * Rolls every person's ledger into one household view.
 *
 * The row axis - year, age, years to/in retirement, retired-or-not - comes
 * from the SELECTED person, since two people rarely share a birth year or a
 * retirement year and there's no meaningful "household age". Every money
 * column is the sum across all persons, plus shared balances counted once.
 *
 * All persons' ledgers are projected over the identical year range (see
 * getProjectionHorizonEndYear), so this is a straight row-by-row zip.
 */
export function combineLedgers(ledgers: PersonLedger[], primaryPersonId: string, sharedBuckets: AccountBucket[] = []): LedgerResult {
  if (ledgers.length === 0) return { rows: [], warnings: [] };

  const primary = ledgers.find((l) => l.plan.id === primaryPersonId) ?? ledgers[0];
  const firstError = ledgers.find((l) => l.result.error)?.result.error;
  if (firstError) return { rows: [], warnings: [], error: firstError };

  const sharedBucketIds = sharedBuckets.map((b) => b.id);

  const warnings: EngineWarning[] = ledgers.flatMap((l) =>
    l.result.warnings.map((w) => ({ ...w, message: `${l.plan.label}: ${w.message}` })),
  );

  const rows: LedgerYearRow[] = primary.result.rows.map((primaryRow, index) => {
    const rowsAcross = ledgers.map((l) => l.result.rows[index]).filter((row): row is LedgerYearRow => row !== undefined);
    const sum = (pick: (row: LedgerYearRow) => number) => rowsAcross.reduce((total, row) => total + pick(row), 0);

    const accountEnd = mergeBalanceRecords(rowsAcross.map((r) => r.accountEnd));
    // Per-person totalNetWorth deliberately excludes shared balances (nobody
    // owns them), so the household total adds them back exactly once here.
    const sharedNetWorth = sharedBucketIds.reduce((total, id) => total + (accountEnd[id] ?? 0), 0);

    return {
      year: primaryRow.year,
      age: primaryRow.age,
      yearsToOrInRetirement: primaryRow.yearsToOrInRetirement,
      isRetired: primaryRow.isRetired,

      spendingNominal: sum((r) => r.spendingNominal),
      spendingReal: sum((r) => r.spendingReal),

      incomes: rowsAcross.flatMap((r) => r.incomes),
      benefits: rowsAcross.flatMap((r) => r.benefits),

      accountStart: mergeBalanceRecords(rowsAcross.map((r) => r.accountStart)),
      withdrawals: mergeFlowRecords(rowsAcross.map((r) => r.withdrawals)),
      contributions: mergeFlowRecords(rowsAcross.map((r) => r.contributions)),
      // Shared growth is recorded on the primary person's row only (it runs
      // once at household level), so a flow-style sum can't double-count it.
      growth: mergeFlowRecords(rowsAcross.map((r) => r.growth)),
      accountEnd,

      cashBufferReplenishment: sum((r) => r.cashBufferReplenishment),
      meltdownWithdrawalTotal: sum((r) => r.meltdownWithdrawalTotal),
      requiredDistributionTotal: sum((r) => r.requiredDistributionTotal),

      taxesPaid: {
        federal: sum((r) => r.taxesPaid.federal),
        stateOrProvincial: sum((r) => r.taxesPaid.stateOrProvincial),
        total: sum((r) => r.taxesPaid.total),
      },

      totalNetWorth: sum((r) => r.totalNetWorth) + sharedNetWorth,

      overriddenFields: [...new Set(ledgers.flatMap((l) => l.result.rows[index]?.overriddenFields ?? []))],
      // Prefixed with the owner's label so a combined row's audit trail says
      // which person each step belongs to.
      audit: {
        steps: ledgers.flatMap((l) =>
          (l.result.rows[index]?.audit.steps ?? []).map((step) => ({ ...step, label: `${l.plan.label} · ${step.label}` })),
        ),
      },
    };
  });

  return { rows, warnings };
}
