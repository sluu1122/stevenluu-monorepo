import { describe, expect, test } from 'vitest';
import { partitionWarnings, groupWarnings, describeYears } from './warnings';
import type { EngineWarning } from '../engine/types';

const shortfall = (year: number, amount = 1): EngineWarning => ({
  year,
  kind: 'spendingShortfall',
  code: 'spending.accountsExhausted',
  amount,
  message: `Shortfall of ${amount.toFixed(2)}: exhausted.`,
});
const contribution = (year: number, amount = 1): EngineWarning => ({
  year,
  kind: 'contributionUnfunded',
  code: 'contribution.noEligibleSource',
  amount,
  // The per-year figure that made message-keyed grouping useless.
  message: `Contributions short by ${amount.toFixed(2)}: no eligible source.`,
});
const sharedContribution = (year: number, amount = 1): EngineWarning => ({
  year,
  kind: 'contributionUnfunded',
  code: 'contribution.sharedCashShort',
  amount,
  message: `Shared contribution short by ${amount.toFixed(2)}.`,
});

describe('partitionWarnings', () => {
  test('splits the two kinds apart', () => {
    const { shortfalls, contributions } = partitionWarnings([shortfall(2030), contribution(2027), shortfall(2031), contribution(2028)]);
    expect(shortfalls.map((w) => w.year)).toEqual([2030, 2031]);
    expect(contributions.map((w) => w.year)).toEqual([2027, 2028]);
  });

  test('a plan with only contribution notices reports zero shortfalls', () => {
    // The bug this whole change exists for: 29 contribution notices were being
    // counted and shown as "29 shortfalls in this plan".
    const { shortfalls, contributions } = partitionWarnings([contribution(2027), contribution(2028), contribution(2029)]);
    expect(shortfalls).toHaveLength(0);
    expect(contributions).toHaveLength(3);
  });

  test('empty input yields empty groups rather than undefined', () => {
    expect(partitionWarnings([])).toEqual({ shortfalls: [], contributions: [] });
  });
});

describe('groupWarnings', () => {
  // The regression that shipped in my first attempt: grouping keyed off
  // `message`, which embeds a per-year dollar figure, so 29 identical problems
  // became 29 "groups" and the banner reported the group count as if it were a
  // number of contributions.
  test('collapses the same reason into one group even when every amount differs', () => {
    const groups = groupWarnings([contribution(2027, 9400), contribution(2028, 9988), contribution(2029, 10600)]);
    expect(groups).toHaveLength(1);
    expect(groups[0].years).toEqual([2027, 2028, 2029]);
    expect(groups[0].code).toBe('contribution.noEligibleSource');
  });

  test('totals the amount across the group rather than reporting one year', () => {
    const groups = groupWarnings([contribution(2027, 100), contribution(2028, 250)]);
    expect(groups[0].totalAmount).toBe(350);
  });

  test('keeps different reason codes apart', () => {
    const groups = groupWarnings([contribution(2027), sharedContribution(2028), contribution(2029)]);
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.code === 'contribution.noEligibleSource')!.years).toEqual([2027, 2029]);
    expect(groups.find((g) => g.code === 'contribution.sharedCashShort')!.years).toEqual([2028]);
  });

  test('empty input yields no groups', () => {
    expect(groupWarnings([])).toEqual([]);
  });
});

describe('describeYears', () => {
  test('formats by count', () => {
    expect(describeYears([])).toBe('');
    expect(describeYears([2027])).toBe('2027');
    expect(describeYears([2027, 2029])).toBe('2027 and 2029');
    expect(describeYears([2027, 2028, 2029])).toBe('2027-2029 (3 years)');
  });

  test('sorts before describing a range, so unordered input still reads correctly', () => {
    expect(describeYears([2031, 2027, 2029])).toBe('2027-2031 (3 years)');
  });
});
