import { describe, expect, it } from 'vitest';
import { applyWithdrawal } from './waterfall';
import type { AccountBucket, WaterfallRule } from './schema';

function bucket(id: string, label: string, taxTreatment: AccountBucket['taxTreatment'] = 'taxable'): AccountBucket {
  return {
    id,
    label,
    country: 'US',
    kind: 'US_TAXABLE_BROKERAGE',
    taxTreatment,
    startingBalance: 0,
  };
}

const buckets = [bucket('cash', 'Cash'), bucket('taxable', 'Taxable'), bucket('trad', 'Traditional', 'taxDeferred')];
const waterfall: WaterfallRule = [
  { order: 0, accountBucketId: 'cash' },
  { order: 1, accountBucketId: 'taxable' },
  { order: 2, accountBucketId: 'trad' },
];

describe('applyWithdrawal', () => {
  it('draws entirely from the first bucket when it has enough', () => {
    const balances = { cash: 10_000, taxable: 5_000, trad: 5_000 };
    const result = applyWithdrawal(4_000, buckets, waterfall, balances, 2026, 100);
    expect(result.withdrawals).toEqual({ cash: 4_000 });
    expect(result.shortfall).toBe(0);
    expect(result.warning).toBeUndefined();
  });

  it('spills over into subsequent buckets in waterfall order when the first is insufficient', () => {
    const balances = { cash: 1_000, taxable: 5_000, trad: 5_000 };
    const result = applyWithdrawal(4_000, buckets, waterfall, balances, 2026, 100);
    expect(result.withdrawals).toEqual({ cash: 1_000, taxable: 3_000 });
    expect(result.shortfall).toBe(0);
  });

  it('respects waterfall order regardless of the order buckets are passed in', () => {
    const balances = { trad: 10_000, taxable: 10_000, cash: 100 };
    const result = applyWithdrawal(150, buckets, waterfall, balances, 2026, 100);
    expect(result.withdrawals).toEqual({ cash: 100, taxable: 50 });
  });

  it('records a shortfall warning when all buckets are exhausted', () => {
    const balances = { cash: 100, taxable: 100, trad: 100 };
    const result = applyWithdrawal(1_000, buckets, waterfall, balances, 2030, 100);
    expect(result.shortfall).toBeCloseTo(700, 5);
    expect(result.warning?.year).toBe(2030);
    expect(result.warning?.message).toMatch(/shortfall/i);
  });

  it('withdraws nothing and warns nothing when the need is zero', () => {
    const balances = { cash: 10_000, taxable: 5_000, trad: 5_000 };
    const result = applyWithdrawal(0, buckets, waterfall, balances, 2026, 100);
    expect(result.withdrawals).toEqual({});
    expect(result.warning).toBeUndefined();
  });
});
