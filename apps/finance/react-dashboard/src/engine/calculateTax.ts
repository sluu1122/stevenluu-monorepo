import type { FederalTaxTable, StateOrProvincialTaxTable, TaxBracket, TaxConfig } from './schema';
import type { AuditStep } from './types';

/**
 * The same tax config with every DOLLAR threshold scaled by `indexationFactor`
 * - bracket edges and the standard deduction/BPA. Rates are untouched: a 20.5%
 * bracket stays 20.5%, it just starts higher.
 *
 * Without this, a table entered in today's dollars stays frozen while incomes
 * inflate, so a projection long enough to matter drags every withdrawal into
 * the top bracket on the strength of inflation alone. Both the CRA and the IRS
 * index these annually, so this models the law rather than an assumption.
 *
 * A factor of 1 returns the config unchanged, which is what the toggle off
 * (and the projection's first year) both resolve to.
 */
export function indexTaxConfig(taxConfig: TaxConfig, indexationFactor: number): TaxConfig {
  if (indexationFactor === 1) return taxConfig;
  const table = taxConfig.federalTable;
  const provincial = taxConfig.stateOrProvincialTable;
  const scaleBrackets = (brackets: TaxBracket[]) =>
    brackets.map((bracket) => ({
      ...bracket,
      min: bracket.min * indexationFactor,
      max: bracket.max === null ? null : bracket.max * indexationFactor,
    }));

  return {
    ...taxConfig,
    federalTable: {
      ...table,
      standardDeductionOrBPA: table.standardDeductionOrBPA * indexationFactor,
      brackets: scaleBrackets(table.brackets),
    },
    // The provincial table indexes on exactly the same basis, including the
    // surtax thresholds - Ontario indexes those annually too, and leaving them
    // frozen would drag every retiree into the top surtax band on inflation alone.
    stateOrProvincialTable: {
      ...provincial,
      basicPersonalAmount: provincial.basicPersonalAmount * indexationFactor,
      brackets: scaleBrackets(provincial.brackets),
      surtax: provincial.surtax.map((band) => ({ ...band, taxOver: band.taxOver * indexationFactor })),
    },
  };
}

/** Progressive walk of `brackets` over `taxableIncome`. Shared by both the federal and provincial tables. */
function walkBrackets(taxableIncome: number, brackets: TaxBracket[]): { tax: number; marginalRatePct: number } {
  let tax = 0;
  let marginalRatePct = 0;
  for (const bracket of brackets) {
    if (taxableIncome <= bracket.min) break;
    const upper = bracket.max === null ? taxableIncome : Math.min(taxableIncome, bracket.max);
    const amountInBracket = Math.max(0, upper - bracket.min);
    if (amountInBracket <= 0) continue;
    tax += amountInBracket * bracket.rate;
    marginalRatePct = bracket.rate * 100;
  }
  return { tax, marginalRatePct };
}

export interface FederalTaxResult {
  tax: number;
  marginalRatePct: number;
  steps: AuditStep[];
}

/** Progressive bracket walk against taxable income (gross income less the standard deduction/BPA). */
export function calculateFederalTax(grossIncome: number, table: FederalTaxTable): FederalTaxResult {
  const taxableIncome = Math.max(0, grossIncome - table.standardDeductionOrBPA);
  const steps: AuditStep[] = [
    {
      label: 'Taxable income',
      formula: 'max(0, grossIncome - standardDeductionOrBPA)',
      inputs: { grossIncome, standardDeductionOrBPA: table.standardDeductionOrBPA },
      result: taxableIncome,
      relatedFields: ['taxesPaid.federal'],
    },
  ];

  let tax = 0;
  let marginalRatePct = 0;

  for (const bracket of table.brackets) {
    if (taxableIncome <= bracket.min) break;
    const upper = bracket.max === null ? taxableIncome : Math.min(taxableIncome, bracket.max);
    const amountInBracket = Math.max(0, upper - bracket.min);
    if (amountInBracket <= 0) continue;

    const taxInBracket = amountInBracket * bracket.rate;
    tax += taxInBracket;
    marginalRatePct = bracket.rate * 100;

    steps.push({
      label: `${(bracket.rate * 100).toFixed(1)}% federal bracket`,
      formula: '(min(taxableIncome, bracketMax) - bracketMin) × rate',
      inputs: {
        taxableIncome,
        bracketMin: bracket.min,
        bracketMax: bracket.max ?? Number.POSITIVE_INFINITY,
        rate: bracket.rate,
      },
      result: taxInBracket,
      relatedFields: ['taxesPaid.federal'],
    });
  }

  return { tax, marginalRatePct, steps };
}

export interface StateOrProvincialTaxResult {
  tax: number;
  marginalRatePct: number;
  steps: AuditStep[];
}

/**
 * Provincial or state tax: a progressive bracket walk, less a basic-personal-
 * amount credit, plus any surtax.
 *
 * The credit is subtracted from the TAX, not from income, because that is how
 * it actually works - a personal amount is worth the same to a top-bracket
 * earner as to a bottom-bracket one. Subtracting it from income instead (as
 * the federal side of this file still does) hands the high earner relief at
 * their marginal rate rather than at the credit rate.
 *
 * Surtax is charged on the tax remaining after that credit, which is the
 * Ontario ordering.
 */
export function calculateStateOrProvincialTax(grossIncome: number, table: StateOrProvincialTaxTable): StateOrProvincialTaxResult {
  const income = Math.max(0, grossIncome);
  const { tax: beforeCredit, marginalRatePct } = walkBrackets(income, table.brackets);

  // Capped at the tax owing: a non-refundable credit can take the bill to zero
  // but never below it, and never pays anything out.
  const credit = Math.min(beforeCredit, table.basicPersonalAmount * table.creditRate);
  const afterCredit = beforeCredit - credit;

  const surtax = table.surtax.reduce((sum, band) => sum + Math.max(0, afterCredit - band.taxOver) * band.rate, 0);

  const steps: AuditStep[] = [
    {
      label: `${table.label} tax`,
      formula: 'progressive bracket walk over gross income',
      inputs: { grossIncome: income, topRatePct: marginalRatePct },
      result: beforeCredit,
      relatedFields: ['taxesPaid.stateOrProvincial'],
    },
  ];
  if (credit > 0) {
    steps.push({
      label: `${table.label} basic personal amount (credit)`,
      formula: 'min(taxOwing, basicPersonalAmount × creditRate)',
      inputs: { basicPersonalAmount: table.basicPersonalAmount, creditRate: table.creditRate },
      result: -credit,
      relatedFields: ['taxesPaid.stateOrProvincial'],
    });
  }
  if (surtax > 0) {
    steps.push({
      label: `${table.label} surtax`,
      formula: 'Σ over bands of max(0, taxAfterCredit - taxOver) × rate',
      inputs: { taxAfterCredit: afterCredit, bands: table.surtax.length },
      result: surtax,
      relatedFields: ['taxesPaid.stateOrProvincial'],
    });
  }

  return { tax: afterCredit + surtax, marginalRatePct, steps };
}

export interface TotalTaxResult {
  federal: number;
  stateOrProvincial: number;
  total: number;
  marginalRatePct: number;
  steps: AuditStep[];
}

/**
 * Combined federal plus state/provincial tax on one person's gross income.
 *
 * `marginalRatePct` is the COMBINED marginal rate - the two tables have
 * different bracket edges, so the rate that matters for a decision is the sum,
 * not either one alone. Any surtax is excluded from it, since a surtax steps
 * on the tax rather than on income.
 */
export function calculateTotalTax(grossIncome: number, taxConfig: TaxConfig): TotalTaxResult {
  const { tax: federal, marginalRatePct: federalMarginal, steps: federalSteps } = calculateFederalTax(grossIncome, taxConfig.federalTable);
  const provincial = calculateStateOrProvincialTax(grossIncome, taxConfig.stateOrProvincialTable);

  return {
    federal,
    stateOrProvincial: provincial.tax,
    total: federal + provincial.tax,
    marginalRatePct: federalMarginal + provincial.marginalRatePct,
    steps: [...federalSteps, ...provincial.steps],
  };
}
