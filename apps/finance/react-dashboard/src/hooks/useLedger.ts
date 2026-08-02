import { useMemo } from 'react';
import { buildLedger } from '../engine/ledger';
import type { LedgerResult } from '../engine/types';
import type { GridOverride, Scenario } from '../engine/schema';

const EMPTY_RESULT: LedgerResult = { rows: [], warnings: [] };

export function useLedger(scenario: Scenario | null, overrides: GridOverride[]): LedgerResult {
  return useMemo(() => {
    if (!scenario) return EMPTY_RESULT;
    return buildLedger(scenario, overrides);
  }, [scenario, overrides]);
}
