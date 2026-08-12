export type {
  Country,
  FilingStatus,
  Currency,
  TaxBracket,
  FederalTaxTable,
  TaxConfig,
  AccountKind,
  AccountBucket,
  TaxTreatment,
  WaterfallStep,
  WaterfallRule,
  CashBufferRule,
  InflationAssumption,
  IncomeSource,
  BenefitType,
  BenefitConfig,
  PersonPlan,
  MeltdownRule,
  GridOverride,
  Scenario,
  ExportBundle,
} from './schema';

export interface AuditStep {
  label: string;
  formula: string;
  inputs: Record<string, number>;
  result: number;
  /** LedgerYearRow field names this step explains, for cell-click -> step highlighting. */
  relatedFields: string[];
}

export interface FormulaBreakdown {
  steps: AuditStep[];
}

/**
 * What kind of problem a warning describes. These are not the same severity and
 * must not be counted together:
 *
 * - `spendingShortfall` means the plan could not fund the household's spending
 *   and tax - the money genuinely ran out. This is the serious one.
 * - `contributionUnfunded` means a scheduled contribution had no eligible
 *   source to come from. Contributions may only be funded from cash or from a
 *   taxable account OTHER than the one being contributed to, and never out of
 *   the current year's growth. Net worth can still be compounding while these
 *   fire - most often they mean a scheduled contribution points at the same
 *   account that already receives the household's surplus, which would be the
 *   same dollars counted twice.
 */
export type EngineWarningKind = 'spendingShortfall' | 'contributionUnfunded';

/**
 * A stable identifier for WHY a warning fired, safe to group on.
 *
 * `message` deliberately embeds the dollar figure, which differs every year, so
 * it is useless as a grouping key - grouping on it turned 29 identical problems
 * into 29 separate "groups".
 */
export type EngineWarningCode =
  | 'spending.accountsExhausted'
  | 'contribution.noEligibleSource'
  | 'contribution.sharedCashShort';

export interface EngineWarning {
  year: number;
  kind: EngineWarningKind;
  code: EngineWarningCode;
  /** The shortfall or unfunded amount, so a group can be totalled rather than showing one arbitrary year's figure. */
  amount: number;
  message: string;
}

export interface LedgerYearRow {
  year: number;
  age: number;
  yearsToOrInRetirement: number;
  isRetired: boolean;

  spendingNominal: number;
  spendingReal: number;

  incomes: { sourceId: string; amount: number }[];
  benefits: { type: string; amount: number }[];

  accountStart: Record<string, number>;
  withdrawals: Record<string, number>;
  contributions: Record<string, number>;
  growth: Record<string, number>;
  accountEnd: Record<string, number>;

  cashBufferReplenishment: number;
  meltdownWithdrawalTotal: number;
  /** Gross statutory minimum withdrawn from tax-deferred accounts this year (US RMD / Canadian RRIF minimum). */
  requiredDistributionTotal: number;

  taxesPaid: { federal: number; stateOrProvincial: number; total: number };

  totalNetWorth: number;

  overriddenFields: string[];
  audit: FormulaBreakdown;
}

export interface LedgerResult {
  rows: LedgerYearRow[];
  warnings: EngineWarning[];
  error?: { message: string; stack?: string };
}
