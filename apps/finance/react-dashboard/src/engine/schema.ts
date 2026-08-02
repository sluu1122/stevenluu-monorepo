import { z } from 'zod';

export const CountrySchema = z.enum(['US', 'CA']);
export const FilingStatusSchema = z.enum(['single', 'marriedFilingJointly']);
export const CurrencySchema = z.enum(['USD', 'CAD']);

export const TaxBracketSchema = z.object({
  min: z.number().nonnegative(),
  max: z.number().positive().nullable(),
  rate: z.number().min(0).max(1),
});
export type TaxBracket = z.infer<typeof TaxBracketSchema>;

export const FederalTaxTableSchema = z.object({
  country: CountrySchema,
  year: z.number().int(),
  filingStatus: FilingStatusSchema,
  brackets: z.array(TaxBracketSchema).min(1),
  standardDeductionOrBPA: z.number().nonnegative(),
});
export type FederalTaxTable = z.infer<typeof FederalTaxTableSchema>;

export const TaxConfigSchema = z.object({
  country: CountrySchema,
  filingStatus: FilingStatusSchema,
  federalTable: FederalTaxTableSchema,
  stateOrProvincialFlatRatePct: z.number().min(0).max(100),
});
export type TaxConfig = z.infer<typeof TaxConfigSchema>;

export const USAccountKindSchema = z.enum([
  'US_TAXABLE_BROKERAGE',
  'US_TRADITIONAL_401K_IRA',
  'US_ROTH_401K_IRA',
  'US_CASH_HYSA',
]);
export const CAAccountKindSchema = z.enum([
  'CA_NON_REGISTERED',
  'CA_RRSP_RRIF',
  'CA_TFSA',
  'CA_CASH_POOL',
]);
export const AccountKindSchema = z.union([USAccountKindSchema, CAAccountKindSchema]);
export type AccountKind = z.infer<typeof AccountKindSchema>;

export const TaxTreatmentSchema = z.enum(['taxable', 'taxDeferred', 'taxFree']);

export const AccountBucketSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  country: CountrySchema,
  kind: AccountKindSchema,
  taxTreatment: TaxTreatmentSchema,
  startingBalance: z.number().nonnegative(),
  preRetirementReturnPct: z.number(),
  postRetirementReturnPct: z.number(),
  annualContributionWhileWorking: z.number().nonnegative().optional(),
  isCashBuffer: z.boolean().optional(),
});
export type AccountBucket = z.infer<typeof AccountBucketSchema>;

export const WaterfallStepSchema = z.object({
  order: z.number().int().nonnegative(),
  accountBucketId: z.string(),
});
export const WaterfallRuleSchema = z.array(WaterfallStepSchema);
export type WaterfallStep = z.infer<typeof WaterfallStepSchema>;
export type WaterfallRule = z.infer<typeof WaterfallRuleSchema>;

export const CashBufferRuleSchema = z.object({
  enabled: z.boolean(),
  targetMonthsOfSpending: z.number().nonnegative(),
  replenishmentOrder: z.array(z.string()),
});
export type CashBufferRule = z.infer<typeof CashBufferRuleSchema>;

export const InflationYearOverrideSchema = z.object({
  year: z.number().int(),
  ratePct: z.number(),
});
export const InflationAssumptionSchema = z.object({
  mode: z.enum(['flat', 'byYear']),
  flatRatePct: z.number().optional(),
  byYear: z.array(InflationYearOverrideSchema).optional(),
});
export type InflationAssumption = z.infer<typeof InflationAssumptionSchema>;

export const IncomeSourceSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  startYear: z.number().int(),
  endYear: z.number().int().optional(),
  annualAmountNominal: z.number().nonnegative(),
  growthRatePct: z.number(),
});
export type IncomeSource = z.infer<typeof IncomeSourceSchema>;

export const BenefitTypeSchema = z.enum(['US_SOCIAL_SECURITY', 'CA_CPP', 'CA_OAS']);
export const BenefitConfigSchema = z.object({
  type: BenefitTypeSchema,
  claimAge: z.number().int().positive(),
  monthlyBenefitAtClaimAge: z.number().nonnegative(),
  colaPct: z.number(),
});
export type BenefitConfig = z.infer<typeof BenefitConfigSchema>;

export const GridOverrideSchema = z.object({
  id: z.string(),
  scenarioId: z.string(),
  year: z.number().int(),
  field: z.string().min(1),
  value: z.number(),
  note: z.string().optional(),
  createdAt: z.string(),
});
export type GridOverride = z.infer<typeof GridOverrideSchema>;

export const ScenarioSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  country: CountrySchema,
  version: z.number().int().nonnegative(),
  currency: CurrencySchema,
  exchangeRateUsdToCad: z.number().positive(),
  birthYear: z.number().int(),
  planningEndAge: z.number().int().positive(),
  retirementStartYear: z.number().int().nullable(),
  accountBuckets: z.array(AccountBucketSchema),
  waterfall: WaterfallRuleSchema,
  cashBufferRule: CashBufferRuleSchema,
  taxConfig: TaxConfigSchema,
  inflation: InflationAssumptionSchema,
  incomeSources: z.array(IncomeSourceSchema),
  benefits: z.array(BenefitConfigSchema),
  annualSpendingRealAtRetirement: z.number().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Scenario = z.infer<typeof ScenarioSchema>;

export const ExportBundleSchema = z.object({
  schemaVersion: z.number().int().nonnegative(),
  exportedAt: z.string(),
  scenarios: z.array(ScenarioSchema),
  overrides: z.array(GridOverrideSchema),
});
export type ExportBundle = z.infer<typeof ExportBundleSchema>;

export const CURRENT_SCHEMA_VERSION = 1;
