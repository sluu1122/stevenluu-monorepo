import type { EngineWarning, EngineWarningCode } from '../engine/types';

/** Human-readable explanation per reason code, written for someone reading the plan rather than the engine. */
/**
 * Each of these names a lever, not just a fact. A warning that says only what
 * happened leaves the reader knowing their plan is broken and not knowing which
 * of a dozen settings to touch - and the fix is rarely the obvious one, since
 * the most common shortfall is money the plan HAS but is too young to reach.
 */
export const WARNING_CODE_EXPLANATION: Record<EngineWarningCode, string> = {
  'spending.accountsExhausted':
    'Every account available at this age was drawn to zero before the spending and tax need was met. Lower spending, retire later, or - if money is sitting in accounts the plan is too young to reach - check Account Availability Ages and the Withdrawal Order.',
  'contribution.noEligibleSource':
    "A contribution can only be funded from cash or from a taxable account other than the one receiving it. This usually means a scheduled contribution points at the same account that already receives your surplus - the same money asked for twice. Clear that account's Annual contribution, or point the surplus somewhere else.",
  'contribution.sharedCashShort':
    "The shared cash account didn't hold enough to cover a shared account's scheduled contribution. Lower that contribution, raise the household cash buffer's target, or fund it from a personal account instead.",
  'contribution.overStatutoryLimit':
    'More is going into a 401(k)/IRA than the law allows for that age, counting both the traditional and Roth accounts against the same limits. The projection still makes the contribution, so the balances are optimistic - lower the annual contribution on those accounts. Canadian accounts are not checked this way because RRSP and TFSA room carries forward, so exceeding one year’s limit there is often correct.',
};

export interface PartitionedWarnings {
  /** The money genuinely ran out. Serious - this is what "shortfall" means. */
  shortfalls: EngineWarning[];
  /**
   * A scheduled contribution had no eligible source. Net worth is usually still
   * compounding when these fire, so they must never be counted as shortfalls or
   * shown in the same alarming treatment.
   */
  contributions: EngineWarning[];
}

/**
 * Splits engine warnings by severity so the UI can report them separately.
 *
 * Both used to be rendered as "N shortfalls in this plan", which was actively
 * misleading: the demo scenarios showed 29 red shortfalls on a plan whose net
 * worth compounds to eight figures, because a scheduled contribution pointed at
 * the same account that already receives the household's surplus.
 */
export function partitionWarnings(warnings: EngineWarning[]): PartitionedWarnings {
  return {
    shortfalls: warnings.filter((w) => w.kind === 'spendingShortfall'),
    contributions: warnings.filter((w) => w.kind === 'contributionUnfunded'),
  };
}

export interface WarningGroup {
  code: EngineWarningCode;
  years: number[];
  /** Summed across the group - one year's figure alone would misrepresent a 29-year problem. */
  totalAmount: number;
}

/**
 * Contribution notices repeat every year once a scenario is configured this
 * way, so listing sixty of them is noise.
 *
 * Grouped by `code`, never by `message`: the message embeds a per-year dollar
 * figure, so keying on it produced one "group" per year and defeated the point.
 */
export function groupWarnings(warnings: EngineWarning[]): WarningGroup[] {
  const byCode = new Map<EngineWarningCode, WarningGroup>();
  for (const warning of warnings) {
    const existing = byCode.get(warning.code);
    if (existing) {
      existing.years.push(warning.year);
      existing.totalAmount += warning.amount;
    } else {
      byCode.set(warning.code, { code: warning.code, years: [warning.year], totalAmount: warning.amount });
    }
  }
  return [...byCode.values()];
}

/** "2027", "2027 and 2029", or "2027-2055 (29 years)" - whichever reads best. */
export function describeYears(years: number[]): string {
  if (years.length === 0) return '';
  if (years.length === 1) return String(years[0]);
  const sorted = [...years].sort((a, b) => a - b);
  if (years.length === 2) return `${sorted[0]} and ${sorted[1]}`;
  return `${sorted[0]}-${sorted[sorted.length - 1]} (${sorted.length} years)`;
}
