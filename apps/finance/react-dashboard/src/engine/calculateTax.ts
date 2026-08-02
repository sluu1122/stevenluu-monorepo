import type { FederalTaxTable, TaxConfig } from './schema';
import type { AuditStep } from './types';

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

export interface TotalTaxResult {
  federal: number;
  stateOrProvincial: number;
  total: number;
  marginalRatePct: number;
  steps: AuditStep[];
}

/**
 * State/provincial tax is a single flat rate on gross income (not a bracket
 * table) - a documented v1 simplification, see the plan's "what's cut" list.
 */
export function calculateTotalTax(grossIncome: number, taxConfig: TaxConfig): TotalTaxResult {
  const { tax: federal, marginalRatePct, steps: federalSteps } = calculateFederalTax(grossIncome, taxConfig.federalTable);
  const stateOrProvincial = grossIncome * (taxConfig.stateOrProvincialFlatRatePct / 100);

  const steps: AuditStep[] = [
    ...federalSteps,
    {
      label: 'State/Provincial tax (flat rate)',
      formula: 'grossIncome × stateOrProvincialFlatRatePct%',
      inputs: { grossIncome, stateOrProvincialFlatRatePct: taxConfig.stateOrProvincialFlatRatePct },
      result: stateOrProvincial,
      relatedFields: ['taxesPaid.stateOrProvincial'],
    },
  ];

  return { federal, stateOrProvincial, total: federal + stateOrProvincial, marginalRatePct, steps };
}
