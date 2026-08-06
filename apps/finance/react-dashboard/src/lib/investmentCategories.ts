import type { AccountBucket } from '../engine/schema';
import type { LedgerYearRow } from '../engine/types';

export interface CategorizedBuckets {
  cashBuffer: AccountBucket[];
  taxable: AccountBucket[];
  taxDeferred: AccountBucket[];
  taxFree: AccountBucket[];
}

/** The cash buffer is excluded from "taxable" even though it's taxTreatment 'taxable' - it's liquid reserve, not an investment. */
export function categorizeBuckets(buckets: AccountBucket[]): CategorizedBuckets {
  return {
    cashBuffer: buckets.filter((b) => b.isCashBuffer),
    taxable: buckets.filter((b) => b.taxTreatment === 'taxable' && !b.isCashBuffer),
    taxDeferred: buckets.filter((b) => b.taxTreatment === 'taxDeferred'),
    taxFree: buckets.filter((b) => b.taxTreatment === 'taxFree'),
  };
}

export function sumAccountEnd(row: LedgerYearRow, forBuckets: AccountBucket[]): number {
  return forBuckets.reduce((sum, bucket) => sum + (row.accountEnd[bucket.id] ?? 0), 0);
}

/** A bucket's display label, prefixed with its owner in the combined view where two people can own identically-named accounts. */
export function bucketHeading(bucket: AccountBucket, bucketOwnerLabels?: Record<string, string>): string {
  const owner = bucketOwnerLabels?.[bucket.id];
  return owner ? `${owner} · ${bucket.label}` : bucket.label;
}
