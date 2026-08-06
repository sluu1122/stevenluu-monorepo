import { useContext, useMemo } from 'react';
import { buildScenarioLedger } from '../engine/ledger';
import { combineLedgers, type PersonLedger } from '../engine/combineLedgers';
import { getPrimaryPerson } from '../engine/household';
import { SelectedPersonContext } from '../providers/selected-person-context';
import type { LedgerResult } from '../engine/types';
import type { AccountBucket, GridOverride, PersonPlan, Scenario } from '../engine/schema';

const EMPTY_RESULT: LedgerResult = { rows: [], warnings: [] };

/**
 * Every person's ledger for a scenario, built in one pass and shared by the
 * Planning Grid, Charts and Client Summary. It has to be one pass rather than
 * per-person calls: shared accounts are a single running balance that all
 * persons draw from within the same year.
 *
 * A throw (e.g. a waterfall step pointing at a removed account) is captured
 * as an `error` on every person's result rather than taking down the app.
 */
export function useScenarioLedgers(scenario: Scenario | null, overrides: GridOverride[]): PersonLedger[] {
  return useMemo(() => {
    if (!scenario) return [];
    try {
      return buildScenarioLedger(scenario, overrides);
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      const failure = { message: error.message, stack: error.stack };
      return scenario.persons.map((plan) => ({ plan, result: { rows: [], warnings: [], error: failure } }));
    }
  }, [scenario, overrides]);
}

export interface PersonView extends LedgerResult {
  /** The person driving the row axis - the dropdown selection, or person 1 as a fallback. */
  person: PersonPlan | null;
  /** This person's own buckets plus every shared bucket, or all of them when combined. */
  buckets: AccountBucket[];
  /** Which person owns each bucket - used to disambiguate identically-named accounts in the combined view. */
  bucketOwnerLabels: Record<string, string>;
  /** Ids of jointly-held buckets, so the grid can group them separately from a person's own. */
  sharedBucketIds: Set<string>;
  combined: boolean;
  label: string;
}

const EMPTY_VIEW: PersonView = {
  ...EMPTY_RESULT,
  person: null,
  buckets: [],
  bucketOwnerLabels: {},
  sharedBucketIds: new Set(),
  combined: false,
  label: '',
};

/**
 * The single ledger a view tab should render: one person's, or every
 * person's combined. Reads the selection from SelectedPersonProvider so all
 * three view tabs stay in sync.
 */
export function usePersonView(scenario: Scenario | null, overrides: GridOverride[]): PersonView {
  const ctx = useContext(SelectedPersonContext);
  if (!ctx) throw new Error('usePersonView must be used within a SelectedPersonProvider');
  const { selectedPersonId, combined } = ctx;
  const ledgers = useScenarioLedgers(scenario, overrides);

  return useMemo(() => {
    if (!scenario || ledgers.length === 0) return EMPTY_VIEW;

    const sharedBuckets = scenario.sharedAccountBuckets;
    const sharedBucketIds = new Set(sharedBuckets.map((b) => b.id));

    // The stored id can belong to a different scenario (or a deleted
    // person), so it's resolved against this scenario's persons every time.
    const person = scenario.persons.find((p) => p.id === selectedPersonId) ?? getPrimaryPerson(scenario.persons);
    const bucketOwnerLabels: Record<string, string> = {};
    for (const plan of scenario.persons) {
      for (const bucket of plan.accountBuckets) bucketOwnerLabels[bucket.id] = plan.label;
    }
    for (const bucket of sharedBuckets) bucketOwnerLabels[bucket.id] = 'Shared';

    if (combined && scenario.persons.length > 1) {
      return {
        ...combineLedgers(ledgers, person.id, sharedBuckets),
        person,
        buckets: [...scenario.persons.flatMap((p) => p.accountBuckets), ...sharedBuckets],
        bucketOwnerLabels,
        sharedBucketIds,
        combined: true,
        label: 'Combined',
      };
    }

    const own = ledgers.find((l) => l.plan.id === person.id);
    return {
      ...(own?.result ?? EMPTY_RESULT),
      person,
      buckets: [...person.accountBuckets, ...sharedBuckets],
      bucketOwnerLabels,
      sharedBucketIds,
      combined: false,
      label: person.label,
    };
  }, [scenario, ledgers, selectedPersonId, combined]);
}
