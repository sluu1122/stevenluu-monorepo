import { describe, expect, it } from 'vitest';
import { checkAndReplenish, grossUpForNet } from './cashBuffer';
import { getDefaultFederalTable } from './taxBrackets';
import type { AccountBucket, CashBufferRule, TaxConfig } from './schema';
import { flatRateTable } from './provincialTaxTables';

// The age gate now comes from the account KIND, so a bucket that should be
// gated is built as a 401(k)/IRA (statutory 59.5) rather than by setting an
// age on it directly.
function bucket(id: string, label: string, taxTreatment: AccountBucket['taxTreatment'] = 'taxable', kind: AccountBucket['kind'] = 'US_TAXABLE_BROKERAGE'): AccountBucket {
  return {
    id,
    label,
    country: 'US',
    kind,
    taxTreatment,
    startingBalance: 0,
  };
}

const buckets = [bucket('cash', 'Cash'), bucket('taxable', 'Taxable'), bucket('trad', 'Traditional')];

const taxConfig: TaxConfig = {
  country: 'US',
  filingStatus: 'single',
  federalTable: getDefaultFederalTable('US', 'single'),
  stateOrProvincialTable: flatRateTable(5),
};

function rule(overrides: Partial<CashBufferRule> = {}): CashBufferRule {
  return { enabled: true, targetMonthsOfSpending: 6, replenishmentOrder: ['taxable', 'trad'], ...overrides };
}

/** Trailing args defaulted so the untaxed, unrestricted cases stay readable. */
function replenish(balances: Record<string, number>, r: CashBufferRule, spending: number) {
  return checkAndReplenish(balances, 'cash', r, spending, buckets, 100, 0, taxConfig);
}

describe('checkAndReplenish', () => {
  it('does nothing when the cash buffer already meets the target', () => {
    // target = 6/12 * 60,000 = 30,000
    const balances = { cash: 30_000, taxable: 10_000, trad: 10_000 };
    const result = replenish(balances, rule(), 60_000);
    expect(result.amountTransferred).toBe(0);
    expect(result.pulledFrom).toEqual({});
  });

  it('pulls the shortfall from the first bucket in replenishment order', () => {
    // target = 30,000, cash has 10,000 -> shortfall 20,000
    const balances = { cash: 10_000, taxable: 50_000, trad: 50_000 };
    const result = replenish(balances, rule(), 60_000);
    expect(result.pulledFrom).toEqual({ taxable: 20_000 });
    expect(result.amountTransferred).toBe(20_000);
  });

  it('spills over into later replenishment buckets when the first is insufficient', () => {
    const balances = { cash: 10_000, taxable: 5_000, trad: 50_000 };
    const result = replenish(balances, rule(), 60_000);
    expect(result.pulledFrom).toEqual({ taxable: 5_000, trad: 15_000 });
    expect(result.amountTransferred).toBe(20_000);
  });

  it('is a no-op when the rule is disabled', () => {
    const balances = { cash: 0, taxable: 50_000, trad: 50_000 };
    const result = replenish(balances, rule({ enabled: false }), 60_000);
    expect(result.amountTransferred).toBe(0);
  });

  it('never pulls from the cash bucket itself even if listed in replenishmentOrder', () => {
    const balances = { cash: 10_000, taxable: 50_000, trad: 0 };
    const result = replenish(balances, rule({ replenishmentOrder: ['cash', 'taxable'] }), 60_000);
    expect(result.pulledFrom.cash).toBeUndefined();
    expect(result.pulledFrom.taxable).toBe(20_000);
  });

  it('skips a source the person is too young to reach', () => {
    const gated = [bucket('cash', 'Cash'), bucket('ira', 'IRA', 'taxDeferred', 'US_TRADITIONAL_401K_IRA'), bucket('taxable', 'Taxable')];
    const order = rule({ replenishmentOrder: ['ira', 'taxable'] });

    const tooYoung = checkAndReplenish({ cash: 10_000, ira: 50_000, taxable: 50_000 }, 'cash', order, 60_000, gated, 45, 0, taxConfig);
    expect(tooYoung.pulledFrom.ira).toBeUndefined();
    expect(tooYoung.pulledFrom.taxable).toBe(20_000);

    const oldEnough = checkAndReplenish({ cash: 10_000, ira: 50_000, taxable: 50_000 }, 'cash', order, 60_000, gated, 65, 0, taxConfig);
    expect(oldEnough.pulledFrom.ira).toBeGreaterThan(0);
  });

  it('grosses up a tax-deferred pull so the buffer still lands on target', () => {
    const withIra = [bucket('cash', 'Cash'), bucket('ira', 'IRA', 'taxDeferred')];
    const balances = { cash: 10_000, ira: 500_000 };
    const result = checkAndReplenish(balances, 'cash', rule({ replenishmentOrder: ['ira'] }), 60_000, withIra, 65, 0, taxConfig);

    // 20,000 net is still needed, so MORE than 20,000 has to come out...
    expect(result.amountTransferred).toBeCloseTo(20_000, 2);
    expect(result.pulledFrom.ira).toBeGreaterThan(20_000);
    // ...and the whole gross pull is a taxable distribution.
    expect(result.taxableDistribution).toBeCloseTo(result.pulledFrom.ira, 5);
  });

  it('reports no taxable distribution when only taxable/cash sources are used', () => {
    const balances = { cash: 10_000, taxable: 50_000, trad: 50_000 };
    const result = replenish(balances, rule(), 60_000);
    expect(result.taxableDistribution).toBe(0);
  });
});

describe('grossUpForNet', () => {
  it('returns zero for a zero need', () => {
    expect(grossUpForNet(0, 0, taxConfig, 100_000)).toBe(0);
  });

  it('solves for a gross larger than the net needed', () => {
    expect(grossUpForNet(30_000, 50_000, taxConfig, 1_000_000)).toBeGreaterThan(30_000);
  });

  it('never exceeds the available balance', () => {
    expect(grossUpForNet(30_000, 0, taxConfig, 5_000)).toBe(5_000);
  });
});
