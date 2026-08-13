import type { FederalTaxTable, FilingStatus, StateOrProvincialTaxTable, TaxBracket, TaxConfig } from './schema';
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

/**
 * Progressive bracket walk, with the personal amount applied the way each
 * country actually applies it.
 *
 * The US standard deduction is a DEDUCTION: it comes off income before the
 * brackets, so it is worth the taxpayer's marginal rate.
 *
 * Canada's Basic Personal Amount is a non-refundable CREDIT at the lowest
 * bracket rate, so it is worth the same to every taxpayer. Subtracting it from
 * income instead - which this used to do for both countries - handed a
 * top-bracket Canadian relief at 33% on an amount the CRA only ever relieves at
 * the bottom rate, understating federal tax by thousands a year. The provincial
 * side has always modelled it correctly as a credit; this brings federal into
 * line with it.
 */
export function calculateFederalTax(grossIncome: number, table: FederalTaxTable): FederalTaxResult {
  const isCredit = table.country === 'CA';
  const taxableIncome = isCredit ? Math.max(0, grossIncome) : Math.max(0, grossIncome - table.standardDeductionOrBPA);
  const steps: AuditStep[] = [
    {
      label: 'Taxable income',
      formula: isCredit ? 'grossIncome (the BPA is a credit, applied below)' : 'max(0, grossIncome - standardDeduction)',
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

  if (isCredit) {
    // Valued at the lowest bracket rate, which is what the CRA does, and capped
    // at the tax owing - a non-refundable credit can take the bill to zero but
    // never below it. The high-income phase-out of the federal BPA is not
    // modelled, so this is slightly generous at the top bracket.
    const creditRate = table.brackets[0]?.rate ?? 0;
    const credit = Math.min(tax, table.standardDeductionOrBPA * creditRate);
    tax -= credit;

    if (credit > 0) {
      steps.push({
        label: 'Federal basic personal amount (credit)',
        formula: 'min(taxOwing, basicPersonalAmount × lowestBracketRate)',
        inputs: { basicPersonalAmount: table.standardDeductionOrBPA, creditRate },
        result: -credit,
        relatedFields: ['taxesPaid.federal'],
      });
    }
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
 * The IRS "provisional income" thresholds that decide how much of a Social
 * Security benefit is taxable at all. Unlike almost every other federal
 * dollar figure in this app, these are NOT indexed for inflation - Congress
 * fixed them in 1983 (first tier) and 1993 (second tier) and never revisited
 * them, which is exactly why more of every retiree's benefit becomes taxable
 * over time even with `indexTaxThresholdsToInflation` off.
 */
const SS_PROVISIONAL_INCOME_THRESHOLDS: Record<FilingStatus, { first: number; second: number }> = {
  single: { first: 25_000, second: 34_000 },
  marriedFilingJointly: { first: 32_000, second: 44_000 },
};

export interface SocialSecurityTaxabilityResult {
  taxableAmount: number;
  steps: AuditStep[];
}

/**
 * How much of a Social Security benefit counts as taxable income - the actual
 * IRS formula, not a flat inclusion rate. "Combined income" (everything else
 * plus half the benefit) below the first threshold makes none of it taxable;
 * between the two thresholds, up to half is; above the second, up to 85% is.
 * Most beneficiaries land in the 85% tier within a few years of claiming,
 * since the thresholds above never move.
 */
export function taxableSocialSecurity(benefit: number, otherIncome: number, filingStatus: FilingStatus): SocialSecurityTaxabilityResult {
  if (benefit <= 0) return { taxableAmount: 0, steps: [] };

  const { first, second } = SS_PROVISIONAL_INCOME_THRESHOLDS[filingStatus];
  const combinedIncome = otherIncome + 0.5 * benefit;

  let taxableAmount: number;
  if (combinedIncome <= first) {
    taxableAmount = 0;
  } else if (combinedIncome <= second) {
    taxableAmount = Math.min(0.5 * benefit, 0.5 * (combinedIncome - first));
  } else {
    taxableAmount = Math.min(0.85 * benefit, 0.85 * (combinedIncome - second) + Math.min(6_000, 0.5 * benefit));
  }

  return {
    taxableAmount,
    steps: [
      {
        label: 'Taxable portion of Social Security (provisional-income test)',
        formula: 'combinedIncome = otherIncome + 50% × benefit; 0% below the first threshold, up to 50% between the two, up to 85% above',
        inputs: { benefit, otherIncome, combinedIncome, firstThreshold: first, secondThreshold: second },
        result: taxableAmount,
        relatedFields: ['taxesPaid.federal', 'taxesPaid.stateOrProvincial'],
      },
    ],
  };
}

/**
 * Combined federal plus state/provincial tax on one person's gross income.
 *
 * `socialSecurityBenefit` is the slice of `grossIncome` that's a US Social
 * Security benefit, if any - passed separately because it isn't taxed like
 * ordinary income. Below it, `grossIncome` keeps meaning what every caller
 * already treats it as (this person's full taxable income for the
 * calculation, SS included at its gross amount); this function is what peels
 * the correct taxable slice back out before running the bracket walk. A
 * non-US scenario, or a US person who hasn't claimed yet, passes 0 and gets
 * exactly the old behavior.
 *
 * `marginalRatePct` is the COMBINED marginal rate - the two tables have
 * different bracket edges, so the rate that matters for a decision is the sum,
 * not either one alone. Any surtax is excluded from it, since a surtax steps
 * on the tax rather than on income.
 */
export function calculateTotalTax(grossIncome: number, taxConfig: TaxConfig, socialSecurityBenefit = 0): TotalTaxResult {
  if (socialSecurityBenefit <= 0 || taxConfig.country !== 'US') {
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

  const otherIncome = Math.max(0, grossIncome - socialSecurityBenefit);
  const { taxableAmount: ssTaxable, steps: ssSteps } = taxableSocialSecurity(socialSecurityBenefit, otherIncome, taxConfig.filingStatus);

  const federalGrossIncome = otherIncome + ssTaxable;
  // Most states that tax Social Security at all start from the federally
  // taxable amount rather than the gross benefit - using it here rather than
  // a separate state-specific inclusion rate.
  const stateGrossIncome = otherIncome + (taxConfig.stateOrProvincialTable.taxesSocialSecurity ? ssTaxable : 0);

  const { tax: federal, marginalRatePct: federalMarginal, steps: federalSteps } = calculateFederalTax(federalGrossIncome, taxConfig.federalTable);
  const provincial = calculateStateOrProvincialTax(stateGrossIncome, taxConfig.stateOrProvincialTable);

  return {
    federal,
    stateOrProvincial: provincial.tax,
    total: federal + provincial.tax,
    marginalRatePct: federalMarginal + provincial.marginalRatePct,
    steps: [...ssSteps, ...federalSteps, ...provincial.steps],
  };
}
