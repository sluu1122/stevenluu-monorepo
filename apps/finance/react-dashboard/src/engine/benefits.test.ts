import { describe, expect, it } from 'vitest';
import { applyOasClawback, calculateBenefitForYear } from './benefits';
import { OAS_CLAWBACK_RATE, OAS_CLAWBACK_THRESHOLD_2025 } from './benefitDefaults';
import type { BenefitConfig } from './schema';

describe('calculateBenefitForYear', () => {
  it('is zero before the claim age', () => {
    const benefit: BenefitConfig = { type: 'CA_CPP', personId: 'person-1', claimAge: 65, monthlyBenefitAtClaimAge: 1_000, colaPct: 2 };
    expect(calculateBenefitForYear(benefit, 64).amount).toBe(0);
  });

  it('compounds by colaPct for each year since claim', () => {
    const benefit: BenefitConfig = { type: 'CA_CPP', personId: 'person-1', claimAge: 65, monthlyBenefitAtClaimAge: 1_000, colaPct: 2 };
    expect(calculateBenefitForYear(benefit, 65).amount).toBeCloseTo(12_000, 5);
    expect(calculateBenefitForYear(benefit, 66).amount).toBeCloseTo(12_000 * 1.02, 5);
  });
});

describe('applyOasClawback', () => {
  it('claws back nothing when prior-year income is at or below the threshold', () => {
    const result = applyOasClawback(9_000, OAS_CLAWBACK_THRESHOLD_2025);
    expect(result.clawback).toBe(0);
    expect(result.netAmount).toBe(9_000);
  });

  it('claws back 15% of prior-year income above the threshold', () => {
    const excess = 20_000;
    const result = applyOasClawback(9_000, OAS_CLAWBACK_THRESHOLD_2025 + excess);
    expect(result.clawback).toBeCloseTo(excess * OAS_CLAWBACK_RATE, 5);
    expect(result.netAmount).toBeCloseTo(9_000 - excess * OAS_CLAWBACK_RATE, 5);
  });

  it('never claws back more than the gross benefit itself', () => {
    const result = applyOasClawback(9_000, OAS_CLAWBACK_THRESHOLD_2025 + 1_000_000);
    expect(result.clawback).toBe(9_000);
    expect(result.netAmount).toBe(0);
  });
});
