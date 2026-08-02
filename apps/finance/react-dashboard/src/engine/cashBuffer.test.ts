import { describe, expect, it } from 'vitest';
import { checkAndReplenish } from './cashBuffer';
import type { AccountBucket, CashBufferRule } from './schema';

function bucket(id: string, label: string): AccountBucket {
  return {
    id,
    label,
    country: 'US',
    kind: 'US_TAXABLE_BROKERAGE',
    taxTreatment: 'taxable',
    startingBalance: 0,
    preRetirementReturnPct: 0,
    postRetirementReturnPct: 0,
  };
}

const buckets = [bucket('cash', 'Cash'), bucket('taxable', 'Taxable'), bucket('trad', 'Traditional')];

function rule(overrides: Partial<CashBufferRule> = {}): CashBufferRule {
  return { enabled: true, targetMonthsOfSpending: 6, replenishmentOrder: ['taxable', 'trad'], ...overrides };
}

describe('checkAndReplenish', () => {
  it('does nothing when the cash buffer already meets the target', () => {
    // target = 6/12 * 60,000 = 30,000
    const balances = { cash: 30_000, taxable: 10_000, trad: 10_000 };
    const result = checkAndReplenish(balances, 'cash', rule(), 60_000, buckets);
    expect(result.amountTransferred).toBe(0);
    expect(result.pulledFrom).toEqual({});
  });

  it('pulls the shortfall from the first bucket in replenishment order', () => {
    // target = 30,000, cash has 10,000 -> shortfall 20,000
    const balances = { cash: 10_000, taxable: 50_000, trad: 50_000 };
    const result = checkAndReplenish(balances, 'cash', rule(), 60_000, buckets);
    expect(result.pulledFrom).toEqual({ taxable: 20_000 });
    expect(result.amountTransferred).toBe(20_000);
  });

  it('spills over into later replenishment buckets when the first is insufficient', () => {
    const balances = { cash: 10_000, taxable: 5_000, trad: 50_000 };
    const result = checkAndReplenish(balances, 'cash', rule(), 60_000, buckets);
    expect(result.pulledFrom).toEqual({ taxable: 5_000, trad: 15_000 });
    expect(result.amountTransferred).toBe(20_000);
  });

  it('is a no-op when the rule is disabled', () => {
    const balances = { cash: 0, taxable: 50_000, trad: 50_000 };
    const result = checkAndReplenish(balances, 'cash', rule({ enabled: false }), 60_000, buckets);
    expect(result.amountTransferred).toBe(0);
  });

  it('never pulls from the cash bucket itself even if listed in replenishmentOrder', () => {
    const balances = { cash: 10_000, taxable: 50_000, trad: 0 };
    const result = checkAndReplenish(balances, 'cash', rule({ replenishmentOrder: ['cash', 'taxable'] }), 60_000, buckets);
    expect(result.pulledFrom.cash).toBeUndefined();
    expect(result.pulledFrom.taxable).toBe(20_000);
  });
});
