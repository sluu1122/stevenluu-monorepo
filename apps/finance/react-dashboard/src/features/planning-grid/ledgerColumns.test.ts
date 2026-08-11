import { describe, expect, it } from 'vitest';
import { buildLedgerColumns, BUCKET_TINTS } from './ledgerColumns';
import { createDefaultPersonPlan } from '../../engine/defaults';
import type { AccountBucket } from '../../engine/schema';
import type { MoneyFormatter } from '../../hooks/useDisplayCurrency';

/**
 * These assert the SHAPE of the column model, never rendered output - nothing
 * here calls a `render()`. That's what keeps the suite runnable under vitest's
 * `environment: 'node'` (see vitest.config.ts) with no DOM and no jsdom
 * dependency, even though the module under test is a .tsx.
 */

const money: MoneyFormatter = {
  currency: 'USD',
  convert: (v) => v,
  format: (v) => `$${Math.round(v)}`,
  formatCompact: (v) => `$${Math.round(v)}`,
  isConverted: false,
};

function build(overrides: Partial<Parameters<typeof buildLedgerColumns>[0]> = {}) {
  return buildLedgerColumns({
    money,
    buckets: createDefaultPersonPlan('US', 'Person 1').accountBuckets,
    overrides: [],
    personId: 'person-1',
    allowOverrides: true,
    onEditOverride: () => {},
    ...overrides,
  });
}

describe('ledger column model', () => {
  it('emits the fixed groups in display order around the asset groups', () => {
    const keys = build().map((g) => g.key);
    expect(keys.slice(0, 2)).toEqual(['expenses', 'income']);
    expect(keys.slice(-4)).toEqual(['cashBuffer', 'required', 'taxes', 'combined']);
  });

  it('gives every column a unique id and a non-empty text label', () => {
    const columns = build().flatMap((g) => g.columns);
    expect(columns.length).toBeGreaterThan(0);

    const ids = columns.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);

    // `label` is what the mobile card view renders as the field name, and it
    // can't fall back to `header` (that's JSX for bucket columns).
    for (const column of columns) {
      expect(typeof column.label, `column ${column.id}`).toBe('string');
      expect(column.label.trim(), `column ${column.id}`).not.toBe('');
    }
  });

  it('renders three columns per account bucket', () => {
    const buckets = createDefaultPersonPlan('US', 'Person 1').accountBuckets;
    const assetColumns = build({ buckets })
      .filter((g) => ['taxable', 'taxDeferred', 'taxFree'].includes(g.key))
      .flatMap((g) => g.columns);

    expect(assetColumns).toHaveLength(buckets.length * 3);
    for (const bucket of buckets) {
      expect(assetColumns.filter((c) => c.id.startsWith(bucket.id))).toHaveLength(3);
    }
  });

  it('alternates bucket tints in render order, not in the order buckets were passed', () => {
    // The regression this pins: tints keyed off the input array gave every
    // person's RRSP the same parity, so inside a tax-treatment group two
    // neighbouring accounts shared a tint and the banding read as "per person"
    // rather than "per account". Interleave two people's buckets so input order
    // and render order genuinely disagree.
    const a = createDefaultPersonPlan('US', 'A').accountBuckets;
    const b = createDefaultPersonPlan('US', 'B').accountBuckets;
    const interleaved: AccountBucket[] = a.flatMap((bucket, i) => [bucket, b[i]]);

    const rendered = build({ buckets: interleaved })
      .filter((g) => ['taxable', 'taxDeferred', 'taxFree'].includes(g.key))
      .flatMap((g) => g.columns);

    // One entry per account, in the order the grid actually paints them.
    const tintPerAccount = rendered.filter((c) => c.id.endsWith('-start')).map((c) => c.tintIndex);
    expect(tintPerAccount.length).toBeGreaterThan(2);
    tintPerAccount.forEach((tint, i) => {
      expect(tint, `account #${i} in render order`).toBe(i % BUCKET_TINTS.length);
    });
  });

  it('omits an asset group when no bucket has that tax treatment', () => {
    const taxableOnly = createDefaultPersonPlan('US', 'Person 1').accountBuckets.filter((b) => b.taxTreatment === 'taxable');
    const keys = build({ buckets: taxableOnly }).map((g) => g.key);

    expect(keys).toContain('taxable');
    expect(keys).not.toContain('taxDeferred');
    expect(keys).not.toContain('taxFree');
  });

  it('only adds the shared group when there are shared buckets', () => {
    const buckets = createDefaultPersonPlan('US', 'Person 1').accountBuckets;
    expect(build({ buckets }).map((g) => g.key)).not.toContain('shared');

    const withShared = build({ buckets, sharedBucketIds: new Set([buckets[0].id]) });
    const shared = withShared.find((g) => g.key === 'shared');
    expect(shared?.columns).toHaveLength(3);

    // A shared bucket is pulled OUT of its tax-treatment group, not duplicated.
    const assetColumns = withShared.filter((g) => ['taxable', 'taxDeferred', 'taxFree'].includes(g.key)).flatMap((g) => g.columns);
    expect(assetColumns.some((c) => c.id.startsWith(buckets[0].id))).toBe(false);
  });

  it('keeps the spending column present whether or not overrides are allowed', () => {
    for (const allowOverrides of [true, false]) {
      const expenses = build({ allowOverrides }).find((g) => g.key === 'expenses');
      expect(expenses?.columns.map((c) => c.id)).toEqual(['spendingNominal', 'spendingReal']);
    }
  });
});
