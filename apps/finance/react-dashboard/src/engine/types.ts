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
  BenefitConfig,
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

export interface EngineWarning {
  year: number;
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
