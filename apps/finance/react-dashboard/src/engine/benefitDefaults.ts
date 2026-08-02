/**
 * Seeded 2026 benefit/contribution-limit figures. Suggested UI defaults
 * only - the engine never enforces these, it just uses whatever the user
 * configures on the scenario's BenefitConfig entries.
 * Sources: SSA.gov and Canada.ca, as published in 2026.
 */

export const US_SOCIAL_SECURITY_2026 = {
  colaPct: 2.8,
  fullRetirementAge: 67,
  maxMonthlyBenefitAt62: 2_969,
  maxMonthlyBenefitAtFRA: 4_152,
  maxMonthlyBenefitAt70: 5_181,
  taxableMaxEarnings: 184_500,
};

export const CA_CPP_2026 = {
  maxMonthlyBenefitAt65: 1_507.65,
};

export const CA_OAS_2026 = {
  maxMonthlyBenefit65To74: 743.05,
  maxMonthlyBenefit75Plus: 817.36,
};

/**
 * OAS recovery tax ("clawback"): 15% of net income above the threshold,
 * based on the PRIOR tax year's net income - not the current year's. 2026
 * isn't published yet as of this writing; seeded with the confirmed 2025
 * figure. Source: canada.ca/en/services/benefits/publicpensions/old-age-security/recovery-tax.html
 */
export const OAS_CLAWBACK_THRESHOLD_2025 = 93_454;
export const OAS_CLAWBACK_RATE = 0.15;

export const US_CONTRIBUTION_LIMITS_2026 = {
  the401kEmployeeLimit: 24_500,
  the401kCatchUp50Plus: 8_000,
  the401kCatchUp60To63: 11_250,
  iraLimit: 7_500,
  iraCatchUp50Plus: 1_100,
};

export const CA_CONTRIBUTION_LIMITS_2026 = {
  rrspDollarLimit: 32_490,
  rrspPercentOfPriorYearEarnedIncome: 18,
  tfsaAnnualLimit: 7_000,
};
