import { generateId } from './id';
import type { AccountBucket, AccountKind, Country, TaxTreatment } from './schema';

export interface AccountKindMeta {
  label: string;
  country: Country;
  taxTreatment: TaxTreatment;
  isCashBuffer?: boolean;
}

export const ACCOUNT_KIND_META: Record<AccountKind, AccountKindMeta> = {
  US_CASH_HYSA: { label: 'Cash / HYSA', country: 'US', taxTreatment: 'taxable', isCashBuffer: true },
  US_TAXABLE_BROKERAGE: { label: 'Taxable Brokerage', country: 'US', taxTreatment: 'taxable' },
  US_TRADITIONAL_401K_IRA: { label: 'Traditional 401(k)/IRA', country: 'US', taxTreatment: 'taxDeferred' },
  US_ROTH_401K_IRA: { label: 'Roth 401(k)/IRA', country: 'US', taxTreatment: 'taxFree' },
  CA_CASH_POOL: { label: 'Cash Pool', country: 'CA', taxTreatment: 'taxable', isCashBuffer: true },
  CA_NON_REGISTERED: { label: 'Non-Registered', country: 'CA', taxTreatment: 'taxable' },
  CA_RRSP_RRIF: { label: 'RRSP/RRIF', country: 'CA', taxTreatment: 'taxDeferred' },
  CA_TFSA: { label: 'TFSA', country: 'CA', taxTreatment: 'taxFree' },
};

export const US_ACCOUNT_KINDS: AccountKind[] = ['US_CASH_HYSA', 'US_TAXABLE_BROKERAGE', 'US_TRADITIONAL_401K_IRA', 'US_ROTH_401K_IRA'];
export const CA_ACCOUNT_KINDS: AccountKind[] = ['CA_CASH_POOL', 'CA_NON_REGISTERED', 'CA_RRSP_RRIF', 'CA_TFSA'];

/** A newly added account starts blank - the user fills in real balances and rates. */
export function createBlankAccountBucket(kind: AccountKind): AccountBucket {
  const meta = ACCOUNT_KIND_META[kind];
  return {
    id: generateId('bucket'),
    label: meta.label,
    country: meta.country,
    kind,
    taxTreatment: meta.taxTreatment,
    startingBalance: 0,
    preRetirementReturnPct: 6,
    postRetirementReturnPct: 4,
    isCashBuffer: meta.isCashBuffer,
  };
}
