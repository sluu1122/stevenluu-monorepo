import { describe, expect, it } from 'vitest';
import { calculateRequiredDistributions, requiredDistributionFactor, statutoryDistributionStartAge } from './requiredDistributions';
import type { AccountBucket } from './schema';

function bucket(overrides: Partial<AccountBucket> = {}): AccountBucket {
  return {
    id: 'rrsp',
    label: 'RRSP',
    country: 'CA',
    kind: 'CA_RRSP_RRIF',
    taxTreatment: 'taxDeferred',
    startingBalance: 0,
    ...overrides,
  };
}

describe('statutoryDistributionStartAge', () => {
  it('follows SECURE 2.0 birth-year bands in the US', () => {
    expect(statutoryDistributionStartAge('US', 1949)).toBe(72);
    expect(statutoryDistributionStartAge('US', 1951)).toBe(73);
    expect(statutoryDistributionStartAge('US', 1959)).toBe(73);
    expect(statutoryDistributionStartAge('US', 1960)).toBe(75);
    expect(statutoryDistributionStartAge('US', 1985)).toBe(75);
  });

  it('uses 72 in Canada, the year after the RRIF conversion deadline at 71', () => {
    expect(statutoryDistributionStartAge('CA', 1950)).toBe(72);
    expect(statutoryDistributionStartAge('CA', 1990)).toBe(72);
  });
});

describe('requiredDistributionFactor', () => {
  it('matches the IRS Uniform Lifetime Table divisors', () => {
    // factor is 1/divisor, so this checks the published divisor directly.
    const divisorAt = (age: number) => 1 / requiredDistributionFactor('US', age);
    expect(divisorAt(73)).toBeCloseTo(26.5, 10);
    expect(divisorAt(75)).toBeCloseTo(24.6, 10);
    expect(divisorAt(80)).toBeCloseTo(20.2, 10);
    expect(divisorAt(85)).toBeCloseTo(16.0, 10);
    expect(divisorAt(90)).toBeCloseTo(12.2, 10);
    expect(divisorAt(95)).toBeCloseTo(8.9, 10);
    expect(divisorAt(100)).toBeCloseTo(6.4, 10);
    expect(divisorAt(120)).toBeCloseTo(2.0, 10);
  });

  it('holds the oldest US divisor flat beyond the end of the table', () => {
    expect(requiredDistributionFactor('US', 130)).toBeCloseTo(1 / 2.0, 10);
  });

  it('matches the prescribed Canadian RRIF factors', () => {
    expect(requiredDistributionFactor('CA', 71)).toBeCloseTo(0.0528, 10);
    expect(requiredDistributionFactor('CA', 72)).toBeCloseTo(0.054, 10);
    expect(requiredDistributionFactor('CA', 80)).toBeCloseTo(0.0682, 10);
    expect(requiredDistributionFactor('CA', 90)).toBeCloseTo(0.1192, 10);
    expect(requiredDistributionFactor('CA', 94)).toBeCloseTo(0.1879, 10);
    expect(requiredDistributionFactor('CA', 95)).toBeCloseTo(0.2, 10);
    expect(requiredDistributionFactor('CA', 101)).toBeCloseTo(0.2, 10);
  });

  it('uses the 1/(90 - age) formula below the published Canadian table', () => {
    // The statutory formula reproduces the published rows exactly, which is
    // what makes it safe to use for the ages the table omits.
    expect(requiredDistributionFactor('CA', 65)).toBeCloseTo(0.04, 10);
    expect(requiredDistributionFactor('CA', 68)).toBeCloseTo(1 / 22, 10);
    expect(requiredDistributionFactor('CA', 70)).toBeCloseTo(0.05, 10);
  });

  it('uses whole years, so a mid-year fractional age reads the same row', () => {
    expect(requiredDistributionFactor('US', 75.9)).toBe(requiredDistributionFactor('US', 75));
  });
});

describe('calculateRequiredDistributions', () => {
  const balances = { rrsp: 500_000 };

  it('takes nothing before the start age', () => {
    const result = calculateRequiredDistributions([bucket()], { rrsp: 500_000 }, balances, 1990, 71, null);
    expect(result.totalWithdrawn).toBe(0);
  });

  it('bases the amount on the PRIOR year-end balance, not the current one', () => {
    // Prior year-end 500k at age 72 (5.40%) = 27,000 - unaffected by the
    // account having since grown, which is how the rules actually work.
    const result = calculateRequiredDistributions([bucket()], { rrsp: 500_000 }, { rrsp: 900_000 }, 1990, 72, null);
    expect(result.totalWithdrawn).toBeCloseTo(27_000, 6);
  });

  it('caps at what the account still holds', () => {
    const result = calculateRequiredDistributions([bucket()], { rrsp: 500_000 }, { rrsp: 1_000 }, 1990, 80, null);
    expect(result.totalWithdrawn).toBeCloseTo(1_000, 6);
  });

  it('computes a US distribution off the Uniform Lifetime Table', () => {
    const ira = bucket({ id: 'ira', label: '401(k)', country: 'US', kind: 'US_TRADITIONAL_401K_IRA' });
    // 500,000 / 24.6 at age 75 = 20,325.20...
    const result = calculateRequiredDistributions([ira], { ira: 500_000 }, { ira: 500_000 }, 1950, 75, null);
    expect(result.totalWithdrawn).toBeCloseTo(500_000 / 24.6, 6);
  });

  it('ignores accounts that are not tax-deferred', () => {
    const tfsa = bucket({ id: 'tfsa', label: 'TFSA', kind: 'CA_TFSA', taxTreatment: 'taxFree' });
    const taxable = bucket({ id: 'nr', label: 'Non-Registered', kind: 'CA_NON_REGISTERED', taxTreatment: 'taxable' });
    const result = calculateRequiredDistributions([tfsa, taxable], { tfsa: 500_000, nr: 500_000 }, { tfsa: 500_000, nr: 500_000 }, 1950, 85, null);
    expect(result.totalWithdrawn).toBe(0);
  });

  it('sums across several tax-deferred accounts, each on its own country table', () => {
    const rrsp = bucket({ id: 'rrsp' });
    const ira = bucket({ id: 'ira', label: '401(k)', country: 'US', kind: 'US_TRADITIONAL_401K_IRA' });
    const starting = { rrsp: 200_000, ira: 300_000 };
    const result = calculateRequiredDistributions([rrsp, ira], starting, starting, 1950, 80, null);
    // Canadian factor for 80 is 6.82%; the US divisor for 80 is 20.2.
    expect(result.withdrawals.rrsp).toBeCloseTo(200_000 * 0.0682, 6);
    expect(result.withdrawals.ira).toBeCloseTo(300_000 / 20.2, 6);
    expect(result.totalWithdrawn).toBeCloseTo(200_000 * 0.0682 + 300_000 / 20.2, 6);
  });

  it('honours a start-age override in both directions', () => {
    const early = calculateRequiredDistributions([bucket()], { rrsp: 500_000 }, balances, 1990, 65, 65);
    expect(early.totalWithdrawn).toBeCloseTo(500_000 * 0.04, 6);

    const deferred = calculateRequiredDistributions([bucket()], { rrsp: 500_000 }, balances, 1990, 72, 80);
    expect(deferred.totalWithdrawn).toBe(0);
  });
});
