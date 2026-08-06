import { describe, expect, it } from 'vitest';
import { calculateMeltdownWithdrawal } from './meltdown';
import type { AccountBucket, MeltdownRule } from './schema';

function bucket(id: string, label: string): AccountBucket {
  return {
    id,
    label,
    country: 'CA',
    kind: 'CA_RRSP_RRIF',
    taxTreatment: 'taxDeferred',
    startingBalance: 0,
  };
}

const buckets = [bucket('rrsp', 'RRSP')];

function rule(overrides: Partial<MeltdownRule> = {}): MeltdownRule {
  return {
    accountBucketId: 'rrsp',
    enabled: true,
    targetTaxableIncomeCeiling: 50_000,
    startYear: null,
    endYear: null,
    destinationAccountBucketId: null,
    ...overrides,
  };
}

describe('calculateMeltdownWithdrawal', () => {
  it('is a no-op when disabled', () => {
    const balances = { rrsp: 200_000 };
    const result = calculateMeltdownWithdrawal(rule({ enabled: false }), 2026, 30_000, buckets, balances, 100);
    expect(result.totalWithdrawn).toBe(0);
  });

  it('is a no-op when undefined (unset rule)', () => {
    const balances = { rrsp: 200_000 };
    const result = calculateMeltdownWithdrawal(undefined, 2026, 30_000, buckets, balances, 100);
    expect(result.totalWithdrawn).toBe(0);
  });

  it('is a no-op when its source account no longer exists', () => {
    const balances = { rrsp: 200_000 };
    const result = calculateMeltdownWithdrawal(rule({ accountBucketId: 'deleted' }), 2026, 0, buckets, balances, 100);
    expect(result.totalWithdrawn).toBe(0);
  });

  it('withdraws exactly enough to reach the ceiling', () => {
    const balances = { rrsp: 200_000 };
    const result = calculateMeltdownWithdrawal(rule(), 2026, 30_000, buckets, balances, 100);
    expect(result.totalWithdrawn).toBe(20_000); // 50,000 ceiling - 30,000 already taxable
    expect(result.withdrawals).toEqual({ rrsp: 20_000 });
  });

  it('does nothing once taxable income already meets or exceeds the ceiling', () => {
    const balances = { rrsp: 200_000 };
    const result = calculateMeltdownWithdrawal(rule(), 2026, 60_000, buckets, balances, 100);
    expect(result.totalWithdrawn).toBe(0);
  });

  it('caps at the available balance rather than overdrawing', () => {
    const balances = { rrsp: 5_000 };
    const result = calculateMeltdownWithdrawal(rule(), 2026, 0, buckets, balances, 100);
    expect(result.totalWithdrawn).toBe(5_000);
  });

  it('does nothing outside the configured year window', () => {
    const balances = { rrsp: 200_000 };
    const before = calculateMeltdownWithdrawal(rule({ startYear: 2030 }), 2026, 0, buckets, balances, 100);
    const after = calculateMeltdownWithdrawal(rule({ endYear: 2020 }), 2026, 0, buckets, balances, 100);
    expect(before.totalWithdrawn).toBe(0);
    expect(after.totalWithdrawn).toBe(0);
  });
});
