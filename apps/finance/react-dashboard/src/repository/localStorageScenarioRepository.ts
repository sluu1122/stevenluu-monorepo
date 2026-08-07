import { CURRENT_SCHEMA_VERSION, DEFAULT_RETURN_RATES, DEFAULT_SHARED_CASH_BUFFER_RULE, DEFAULT_TAXABLE_ACCOUNT_TAXATION, ExportBundleSchema } from '../engine/schema';
import { flatRateTable } from '../engine/regionalTaxTables';
import type { AccountKind, ExportBundle, GridOverride, Scenario } from '../engine/schema';
import { ACCOUNT_KIND_META, DEFAULT_HOUSEHOLD_WITHDRAWAL_ORDER } from '../engine/accountKindMeta';
import { createDemoScenarios } from '../engine/demoScenarios';
import type { ScenarioRepository } from './types';
import { generateId } from '../engine/id';

const STORAGE_KEY = 'retirement-planner:v1';

function emptyBundle(): ExportBundle {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, exportedAt: new Date().toISOString(), scenarios: [], overrides: [] };
}

/**
 * A brand-new install (no storage key at all - not the corrupted/failed-
 * validation cases below, which explicitly fall back to empty rather than
 * risk masking a user's real data) gets three demo scenarios instead of a
 * blank slate, so the app shows real output immediately. Persisted right
 * away so re-reading doesn't mint fresh ids on every call.
 *
 * Which scenario becomes ACTIVE is deliberately not decided here: this runs
 * inside the async listScenarios() call, well after ActiveScenarioProvider's
 * own synchronous localStorage read at mount, so writing an active-scenario
 * id directly to localStorage from this layer could never reach that
 * already-rendered provider's React state. ActiveScenarioProvider instead
 * falls back to the first scenario reactively once this data loads.
 */
function seedDemoBundle(): ExportBundle {
  const scenarios = createDemoScenarios();
  const bundle: ExportBundle = { schemaVersion: CURRENT_SCHEMA_VERSION, exportedAt: new Date().toISOString(), scenarios, overrides: [] };
  writeBlob(bundle);
  return bundle;
}

/**
 * v1 -> v2: birthYear/planningEndAge/retirementStartYear/spouse (a single
 * person plus one bolted-on second slot, income tagged owner:'self'|'spouse')
 * become household.persons (any number of people, each with their own
 * income). Detected structurally (no `household`, has a top-level
 * `birthYear`) rather than trusted purely off the blob's declared
 * schemaVersion, so it's a no-op (and safe to call unconditionally) on
 * already-migrated data.
 */
function migrateScenarioV1ToV2(scenario: Record<string, unknown>): Record<string, unknown> {
  if ('household' in scenario || typeof scenario.birthYear !== 'number') return scenario;

  const old = scenario as Record<string, unknown> & {
    birthYear: number;
    planningEndAge: number;
    retirementStartYear: number | null;
    spouse?: { birthYear: number; retirementYear: number | null } | null;
    incomeSources?: Array<Record<string, unknown>>;
    benefits?: Array<Record<string, unknown>>;
  };

  const incomeSources = old.incomeSources ?? [];
  const benefits = old.benefits ?? [];
  const selfIncome = incomeSources.find((s) => (s.owner ?? 'self') === 'self');
  const spouseIncome = incomeSources.find((s) => s.owner === 'spouse');

  const person1Id = generateId('person');
  const persons: Record<string, unknown>[] = [
    {
      id: person1Id,
      label: 'Person 1',
      birthYear: old.birthYear,
      planningEndAge: old.planningEndAge,
      retirementStartYear: old.retirementStartYear,
      annualIncomeNominal: selfIncome?.annualAmountNominal ?? 0,
      incomeGrowthRatePct: selfIncome?.growthRatePct ?? 0,
    },
  ];

  let person2Id: string | null = null;
  if (old.spouse) {
    person2Id = generateId('person');
    persons.push({
      id: person2Id,
      label: 'Person 2',
      birthYear: old.spouse.birthYear,
      // No per-person planningEndAge existed before this - Person 1's is the best available default.
      planningEndAge: old.planningEndAge,
      retirementStartYear: old.spouse.retirementYear,
      annualIncomeNominal: spouseIncome?.annualAmountNominal ?? 0,
      incomeGrowthRatePct: spouseIncome?.growthRatePct ?? 0,
    });
  }

  // Any income source beyond the one absorbed into each person becomes plain
  // unowned "Other Income Sources" - a one-time, acceptable lossiness: it no
  // longer auto-stops at a retirement year, same as "Other Income" always meant.
  const otherIncomeSources = incomeSources
    .filter((s) => s !== selfIncome && s !== spouseIncome)
    .map((s) => {
      const copy = { ...s };
      delete copy.owner;
      return copy;
    });

  const migratedBenefits = benefits.map((b) => {
    const copy = { ...b };
    const personId = copy.owner === 'spouse' && person2Id ? person2Id : person1Id;
    delete copy.owner;
    return { ...copy, personId };
  });

  const migrated: Record<string, unknown> = { ...scenario };
  delete migrated.birthYear;
  delete migrated.planningEndAge;
  delete migrated.retirementStartYear;
  delete migrated.spouse;
  migrated.household = { persons };
  migrated.incomeSources = otherIncomeSources;
  migrated.benefits = migratedBenefits;
  return migrated;
}

/**
 * v2 -> v3: adds annualSpendingRealBeforeRetirement (spending that can now
 * accrue - and be withdrawn for - before retirement, not just after).
 * Backfilled to 0 for existing scenarios, matching the engine's prior
 * hardcoded "no spending before retirement" behavior exactly.
 */
function migrateScenarioV2ToV3(scenario: Record<string, unknown>): Record<string, unknown> {
  if ('annualSpendingRealBeforeRetirement' in scenario) return scenario;
  return { ...scenario, annualSpendingRealBeforeRetirement: 0 };
}

/**
 * v3 -> v4: the household's single shared pool of accounts/waterfall/cash
 * buffer/meltdown/income/spending is split so that each person owns their
 * own complete plan and is calculated (and taxed) independently.
 *
 * Person 1 absorbs everything that used to be shared - the money all sat in
 * one pool, so it stays in one person's pool until the user redistributes
 * it. Other persons keep their identity/timing/income and start with no
 * accounts. Benefits are filed under the person their `personId` named.
 *
 * Returns the migrated scenario plus person 1's id, which the caller needs
 * to stamp onto that scenario's grid overrides.
 */
function migrateScenarioV3ToV4(scenario: Record<string, unknown>): { scenario: Record<string, unknown>; primaryPersonId: string | null } {
  if (!('household' in scenario)) return { scenario, primaryPersonId: null };

  const old = scenario as Record<string, unknown> & {
    household: { persons: Array<Record<string, unknown>> };
    accountBuckets?: unknown[];
    waterfall?: unknown[];
    cashBufferRule?: Record<string, unknown>;
    meltdownRule?: {
      enabled: boolean;
      sourceAccountBucketIds?: string[];
      targetTaxableIncomeCeiling: number;
      startYear: number | null;
      endYear: number | null;
      destinationAccountBucketId: string | null;
    };
    incomeSources?: unknown[];
    benefits?: Array<Record<string, unknown>>;
    annualSpendingRealBeforeRetirement?: number;
    annualSpendingRealAtRetirement?: number;
  };

  const oldPersons = old.household?.persons ?? [];
  if (oldPersons.length === 0) return { scenario, primaryPersonId: null };

  const benefits = old.benefits ?? [];
  // The old single rule named several source buckets at once; each becomes
  // its own rule, since a rule now targets exactly one account.
  const meltdownRules = (old.meltdownRule?.sourceAccountBucketIds ?? []).map((accountBucketId) => ({
    accountBucketId,
    enabled: old.meltdownRule!.enabled,
    targetTaxableIncomeCeiling: old.meltdownRule!.targetTaxableIncomeCeiling,
    startYear: old.meltdownRule!.startYear,
    endYear: old.meltdownRule!.endYear,
    destinationAccountBucketId: old.meltdownRule!.destinationAccountBucketId,
  }));

  const primaryPersonId = String(oldPersons[0].id);
  const knownPersonIds = new Set(oldPersons.map((p) => String(p.id)));

  const persons = oldPersons.map((person, index) => {
    const isPrimary = index === 0;
    // A benefit pointing at a person who no longer exists falls back to person 1.
    const ownBenefits = benefits
      .filter((b) => {
        const owner = typeof b.personId === 'string' && knownPersonIds.has(b.personId) ? b.personId : primaryPersonId;
        return owner === String(person.id);
      })
      .map((b) => {
        const copy = { ...b };
        delete copy.personId;
        return copy;
      });

    return {
      ...person,
      annualSpendingRealBeforeRetirement: isPrimary ? (old.annualSpendingRealBeforeRetirement ?? 0) : 0,
      annualSpendingRealAtRetirement: isPrimary ? (old.annualSpendingRealAtRetirement ?? 0) : 0,
      accountBuckets: isPrimary ? (old.accountBuckets ?? []) : [],
      waterfall: isPrimary ? (old.waterfall ?? []) : [],
      cashBufferRule: isPrimary
        ? (old.cashBufferRule ?? { enabled: false, targetMonthsOfSpending: 6, replenishmentOrder: [] })
        : { enabled: false, targetMonthsOfSpending: 6, replenishmentOrder: [] },
      meltdownRules: isPrimary ? meltdownRules : [],
      incomeSources: isPrimary ? (old.incomeSources ?? []) : [],
      benefits: ownBenefits,
    };
  });

  const migrated: Record<string, unknown> = { ...scenario };
  delete migrated.household;
  delete migrated.accountBuckets;
  delete migrated.waterfall;
  delete migrated.cashBufferRule;
  delete migrated.meltdownRule;
  delete migrated.incomeSources;
  delete migrated.benefits;
  delete migrated.annualSpendingRealBeforeRetirement;
  delete migrated.annualSpendingRealAtRetirement;
  migrated.persons = persons;
  return { scenario: migrated, primaryPersonId };
}

/**
 * v4 -> v5: adds jointly-held accounts (`sharedAccountBuckets`) and a
 * per-person `surplusDestinationAccountBucketId`. Purely additive - existing
 * scenarios get an empty shared list and a null destination, which reproduces
 * the prior behavior exactly (surplus still falls back to the person's own
 * cash-buffer account).
 */
function migrateScenarioV4ToV5(scenario: Record<string, unknown>): Record<string, unknown> {
  if ('sharedAccountBuckets' in scenario) return scenario;
  const persons = Array.isArray(scenario.persons) ? scenario.persons : [];
  return {
    ...scenario,
    sharedAccountBuckets: [],
    persons: persons.map((p) =>
      typeof p === 'object' && p !== null && !('surplusDestinationAccountBucketId' in p)
        ? { ...(p as Record<string, unknown>), surplusDestinationAccountBucketId: null }
        : p,
    ),
  };
}

/**
 * v5 -> v6: adds per-account `availableFromAge` and a household-level
 * `sharedCashBufferRule`.
 *
 * Ages are backfilled from each account's KIND default rather than null - so
 * an existing US Traditional 401(k)/IRA becomes unreachable before 59.5. That
 * is a deliberate behavior change (an early retiree's plan will now skip it
 * and fall through the waterfall); backfilling null would mean the gate never
 * applied to anyone without hand-editing every account. Canadian registered
 * accounts have no minimum age and are unaffected.
 */
function migrateScenarioV5ToV6(scenario: Record<string, unknown>): Record<string, unknown> {
  if ('sharedCashBufferRule' in scenario) return scenario;

  const withAges = (buckets: unknown): unknown =>
    Array.isArray(buckets)
      ? buckets.map((b) => {
          if (typeof b !== 'object' || b === null || 'availableFromAge' in b) return b;
          const bucket = b as Record<string, unknown>;
          const meta = ACCOUNT_KIND_META[bucket.kind as AccountKind];
          return { ...bucket, availableFromAge: meta?.defaultAvailableFromAge ?? null };
        })
      : buckets;

  const persons = Array.isArray(scenario.persons) ? scenario.persons : [];
  return {
    ...scenario,
    sharedCashBufferRule: { ...DEFAULT_SHARED_CASH_BUFFER_RULE },
    sharedAccountBuckets: withAges(scenario.sharedAccountBuckets ?? []),
    persons: persons.map((p) =>
      typeof p === 'object' && p !== null
        ? { ...(p as Record<string, unknown>), accountBuckets: withAges((p as Record<string, unknown>).accountBuckets) }
        : p,
    ),
  };
}

/**
 * The per-person withdrawal waterfalls become one household order over account
 * KINDS.
 *
 * Derived from the FIRST person's existing waterfall rather than from a fixed
 * default, so a household that had deliberately ordered its drawdown keeps that
 * intent: the bucket ids are mapped to their kinds and de-duplicated in place.
 * Any kind nobody listed is appended at the end rather than dropped - a missing
 * kind means "never draw this for spending", which is far too destructive to
 * infer from an old file that had no way to say it.
 */
function deriveWithdrawalOrder(scenario: Record<string, unknown>): AccountKind[] {
  const persons = Array.isArray(scenario.persons) ? scenario.persons : [];
  const first = persons.find((p): p is Record<string, unknown> => typeof p === 'object' && p !== null);
  const shared = Array.isArray(scenario.sharedAccountBuckets) ? scenario.sharedAccountBuckets : [];
  const buckets = [...(Array.isArray(first?.accountBuckets) ? (first!.accountBuckets as unknown[]) : []), ...shared].filter(
    (b): b is Record<string, unknown> => typeof b === 'object' && b !== null,
  );
  const kindById = new Map(buckets.map((b) => [String(b.id), b.kind as AccountKind]));

  const steps = Array.isArray(first?.waterfall) ? (first!.waterfall as unknown[]) : [];
  const ordered: AccountKind[] = [];
  const seen = new Set<AccountKind>();
  const push = (kind: AccountKind | undefined) => {
    if (!kind || seen.has(kind) || !(kind in ACCOUNT_KIND_META)) return;
    seen.add(kind);
    ordered.push(kind);
  };

  for (const step of [...steps].sort((a, b) => Number((a as { order?: number }).order ?? 0) - Number((b as { order?: number }).order ?? 0))) {
    if (typeof step !== 'object' || step === null) continue;
    push(kindById.get(String((step as { accountBucketId?: unknown }).accountBucketId)));
  }
  for (const kind of DEFAULT_HOUSEHOLD_WITHDRAWAL_ORDER) push(kind);
  return ordered;
}

/**
 * Per-person spending becomes one household budget.
 *
 * The household figure is the SUM of what the persons were each spending, and
 * their shares are their proportions of it - so the projection carries over
 * unchanged, including a single-payer household, which migrates to 100/0 and
 * keeps drawing exactly as it did. Nobody's numbers move until they choose to
 * rebalance the shares.
 *
 * Persons retire at different times, so "before" and "at retirement" are summed
 * independently; a household where one partner had spending only at retirement
 * ends up with a smaller before figure, which is what it was already modelling.
 */
function migrateSpendingToHousehold(scenario: Record<string, unknown>): Record<string, unknown> {
  if ('householdSpendingRealAtRetirement' in scenario) return scenario;
  const persons = (Array.isArray(scenario.persons) ? scenario.persons : []).filter(
    (p): p is Record<string, unknown> => typeof p === 'object' && p !== null,
  );

  const num = (value: unknown) => (typeof value === 'number' ? value : 0);
  const before = persons.reduce((sum, p) => sum + num(p.annualSpendingRealBeforeRetirement), 0);
  const atRetirement = persons.reduce((sum, p) => sum + num(p.annualSpendingRealAtRetirement), 0);

  // Shares follow the at-retirement split, the figure that governs most of a
  // projection's length. With nothing to go on, everyone shares equally.
  const total = atRetirement > 0 ? atRetirement : before;
  const shareBasis = (p: Record<string, unknown>) => (atRetirement > 0 ? num(p.annualSpendingRealAtRetirement) : num(p.annualSpendingRealBeforeRetirement));

  return {
    ...scenario,
    householdSpendingRealBeforeRetirement: before,
    householdSpendingRealAtRetirement: atRetirement,
    persons: persons.map((p) => {
      const { annualSpendingRealBeforeRetirement, annualSpendingRealAtRetirement, ...rest } = p;
      void annualSpendingRealBeforeRetirement;
      void annualSpendingRealAtRetirement;
      void total;
      void shareBasis;
      return rest;
    }),
  };
}

/**
 * v6 -> v7: per-account growth rates and per-account `availableFromAge` both
 * move off the account. Rates become one scenario-level pair for investments
 * and another for cash; the age gate becomes a lookup on the account KIND.
 *
 * The scenario-level rates are derived from the rates already in the file, by
 * majority vote within each group, so a household that used one number
 * everywhere (the overwhelmingly common case) migrates with its projection
 * unchanged. A scenario that deliberately gave two investments DIFFERENT rates
 * cannot survive the collapse - the losing rate is dropped - which is why the
 * chosen figures are the ones most accounts already agreed on rather than, say,
 * the first account's.
 *
 * `availableFromAge` needs no rescue: it's simply dropped (Zod strips it), and
 * every read now resolves through ACCOUNT_KIND_META. A hand-edited age is lost
 * and reverts to the statutory one.
 */
function migrateScenarioV6ToV7(scenario: Record<string, unknown>): Record<string, unknown> {
  // Each field is detected on its own rather than gating the whole step on one
  // of them, so a blob that picked up only part of v7 still gets the rest.
  let next = 'indexTaxThresholdsToInflation' in scenario ? scenario : { ...scenario, indexTaxThresholdsToInflation: true };
  if (!('accountAvailabilityAges' in next)) next = { ...next, accountAvailabilityAges: {} };
  if (!('householdWithdrawalOrder' in next)) next = { ...next, householdWithdrawalOrder: deriveWithdrawalOrder(next) };
  next = migrateSpendingToHousehold(next);
  if ('returnRates' in next) return next;
  scenario = next;

  const persons = Array.isArray(scenario.persons) ? scenario.persons : [];
  const shared = Array.isArray(scenario.sharedAccountBuckets) ? scenario.sharedAccountBuckets : [];
  const allBuckets = [...persons.flatMap((p) => (typeof p === 'object' && p !== null && Array.isArray((p as Record<string, unknown>).accountBuckets) ? ((p as Record<string, unknown>).accountBuckets as unknown[]) : [])), ...shared]
    .filter((b): b is Record<string, unknown> => typeof b === 'object' && b !== null);

  const isCash = (b: Record<string, unknown>) => b.isCashBuffer === true || ACCOUNT_KIND_META[b.kind as AccountKind]?.isCashBuffer === true;
  const mostCommon = (values: number[], fallback: number): number => {
    if (values.length === 0) return fallback;
    const counts = new Map<number, number>();
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
    // Ties go to the larger count first, then to the value seen earliest.
    let best = values[0];
    let bestCount = 0;
    for (const v of values) {
      const count = counts.get(v)!;
      if (count > bestCount) {
        best = v;
        bestCount = count;
      }
    }
    return best;
  };
  const rateOf = (b: Record<string, unknown>, key: string): number | null => (typeof b[key] === 'number' ? (b[key] as number) : null);
  const collect = (cash: boolean, key: string) =>
    allBuckets
      .filter((b) => isCash(b) === cash)
      .map((b) => rateOf(b, key))
      .filter((v): v is number => v !== null);

  return {
    ...scenario,
    returnRates: {
      investmentsPreRetirementPct: mostCommon(collect(false, 'preRetirementReturnPct'), DEFAULT_RETURN_RATES.investmentsPreRetirementPct),
      investmentsPostRetirementPct: mostCommon(collect(false, 'postRetirementReturnPct'), DEFAULT_RETURN_RATES.investmentsPostRetirementPct),
      // Cash has always been one field going into a v9+ scenario (see
      // migrateScenarioV8ToV9), so a pre-v7 blob's pre- and post-retirement
      // cash rates are pooled into a single vote rather than two.
      cashPct: mostCommon([...collect(true, 'preRetirementReturnPct'), ...collect(true, 'postRetirementReturnPct')], DEFAULT_RETURN_RATES.cashPct),
    },
  };
}

/**
 * v7 -> v8: the flat provincial rate becomes a real bracket table, non-registered
 * accounts start being taxed, and taxable accounts gain a cost basis.
 *
 * The rate is carried across as a SINGLE-BRACKET table at the same percentage,
 * so a migrated scenario reproduces its old provincial tax to the cent. That is
 * deliberate: we know the old rate but not the province, and silently swapping
 * in BC's table would move every number in someone's plan without them asking.
 * The Tax Assumptions panel offers the real tables to switch to.
 *
 * Taxable-account taxation, by contrast, is turned ON, because leaving it off
 * would preserve a known error rather than a user's choice. Cost basis defaults
 * to each account's starting balance (no embedded gain), which is the neutral
 * assumption and the one the field's own default encodes.
 */
function migrateScenarioV7ToV8(scenario: Record<string, unknown>): Record<string, unknown> {
  const next = { ...scenario };

  const taxConfig = (next.taxConfig ?? {}) as Record<string, unknown>;
  if (!('stateOrProvincialTable' in taxConfig)) {
    const flatRatePct = typeof taxConfig.stateOrProvincialFlatRatePct === 'number' ? taxConfig.stateOrProvincialFlatRatePct : 0;
    const { stateOrProvincialFlatRatePct: _dropped, ...rest } = taxConfig;
    void _dropped;
    next.taxConfig = { ...rest, stateOrProvincialTable: flatRateTable(flatRatePct) };
  }

  if (!('taxableAccountTaxation' in next)) {
    next.taxableAccountTaxation = { ...DEFAULT_TAXABLE_ACCOUNT_TAXATION };
  }

  return next;
}

/**
 * v8 -> v9: cash growth stops splitting by pre/post retirement - see
 * ReturnRatesSchema's own comment for why the split never earned its keep.
 *
 * Carried forward as the POST-retirement rate, on the theory that a retiree's
 * cash buffer - the account this rate actually governs in practice, since a
 * pre-retirement household rarely holds much idle cash - is the number a user
 * more likely set deliberately. When the two already matched (the seeded
 * default, and so the common case), nothing is lost either way.
 */
function migrateScenarioV8ToV9(scenario: Record<string, unknown>): Record<string, unknown> {
  const rates = (scenario.returnRates ?? {}) as Record<string, unknown>;
  if ('cashPct' in rates) return scenario;

  const post = typeof rates.cashPostRetirementPct === 'number' ? rates.cashPostRetirementPct : undefined;
  const pre = typeof rates.cashPreRetirementPct === 'number' ? rates.cashPreRetirementPct : undefined;
  const { cashPreRetirementPct: _pre, cashPostRetirementPct: _post, ...rest } = rates;
  void _pre;
  void _post;

  return { ...scenario, returnRates: { ...rest, cashPct: post ?? pre ?? DEFAULT_RETURN_RATES.cashPct } };
}

/**
 * v9 -> v10: the region table gained `taxesSocialSecurity`, so Social Security
 * can be taxed by the IRS provisional-income formula instead of at a flat
 * 100% inclusion rate. Backfilled to `false` - correct for the great majority
 * of real states/provinces, and identical to the old always-100%-taxable
 * behavior for anyone it isn't (see calculateTax.ts's `socialSecurityBenefit`
 * default of 0, which a false flag here doesn't even need to reach).
 */
function migrateScenarioV9ToV10(scenario: Record<string, unknown>): Record<string, unknown> {
  const taxConfig = (scenario.taxConfig ?? {}) as Record<string, unknown>;
  const table = (taxConfig.stateOrProvincialTable ?? {}) as Record<string, unknown>;
  if ('taxesSocialSecurity' in table) return scenario;

  return { ...scenario, taxConfig: { ...taxConfig, stateOrProvincialTable: { ...table, taxesSocialSecurity: false } } };
}

/** Exported so the JSON-import path (exportImport.ts) can apply the same migration to an uploaded backup file, not just LocalStorage reads. */
export function migrateStorageBlob(raw: unknown, fromVersion: number): unknown {
  void fromVersion; // migration is structurally self-detecting, see migrateScenarioV1ToV2/V2ToV3/V3ToV4/V4ToV5
  if (typeof raw !== 'object' || raw === null || !('scenarios' in raw) || !Array.isArray((raw as { scenarios: unknown }).scenarios)) {
    return raw;
  }
  const bundle = raw as { scenarios: unknown[]; overrides?: unknown[] };

  // Overrides now target one person's ledger, so v3 overrides have to be
  // stamped with the id of the person who absorbed that scenario's accounts.
  // Missing this would silently drop every saved override at validation.
  const primaryPersonIdByScenarioId = new Map<string, string>();

  const migratedScenarios = bundle.scenarios.map((s) => {
    if (typeof s !== 'object' || s === null) return s;
    // Already v4+ - skip the pre-v4 steps entirely. They detect their own era
    // by the presence of root fields that v4 has since moved onto each
    // person, so running them against v4 data would re-add those fields.
    // v4->v5 is additive and self-detecting, so it always runs.
    if ('persons' in s) return migrateScenarioV9ToV10(migrateScenarioV8ToV9(migrateScenarioV7ToV8(migrateScenarioV6ToV7(migrateScenarioV5ToV6(migrateScenarioV4ToV5(s as Record<string, unknown>))))));
    const v3 = migrateScenarioV2ToV3(migrateScenarioV1ToV2(s as Record<string, unknown>));
    const { scenario, primaryPersonId } = migrateScenarioV3ToV4(v3);
    if (primaryPersonId && typeof scenario.id === 'string') {
      primaryPersonIdByScenarioId.set(scenario.id, primaryPersonId);
    }
    return migrateScenarioV9ToV10(migrateScenarioV8ToV9(migrateScenarioV7ToV8(migrateScenarioV6ToV7(migrateScenarioV5ToV6(migrateScenarioV4ToV5(scenario))))));
  });

  const migratedOverrides = (bundle.overrides ?? []).map((o) => {
    if (typeof o !== 'object' || o === null) return o;
    const override = o as Record<string, unknown>;
    if (typeof override.personId === 'string') return override;
    const personId = typeof override.scenarioId === 'string' ? primaryPersonIdByScenarioId.get(override.scenarioId) : undefined;
    return personId ? { ...override, personId } : override;
  });

  return { ...raw, scenarios: migratedScenarios, overrides: migratedOverrides, schemaVersion: CURRENT_SCHEMA_VERSION };
}

function readBlob(): ExportBundle {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return seedDemoBundle();

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    console.warn('[retirement-planner] Corrupted LocalStorage data, starting fresh.');
    return emptyBundle();
  }

  const versionGuess =
    typeof parsedJson === 'object' && parsedJson !== null && 'schemaVersion' in parsedJson
      ? Number((parsedJson as { schemaVersion: unknown }).schemaVersion)
      : CURRENT_SCHEMA_VERSION;
  const migrated = migrateStorageBlob(parsedJson, versionGuess);

  const result = ExportBundleSchema.safeParse(migrated);
  if (!result.success) {
    console.warn('[retirement-planner] LocalStorage data failed validation, starting fresh.', result.error);
    return emptyBundle();
  }
  return result.data;
}

function writeBlob(bundle: ExportBundle): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bundle));
}

export class LocalStorageScenarioRepository implements ScenarioRepository {
  async listScenarios(): Promise<Scenario[]> {
    return readBlob().scenarios;
  }

  async getScenario(id: string): Promise<Scenario | null> {
    return readBlob().scenarios.find((s) => s.id === id) ?? null;
  }

  async saveScenario(scenario: Scenario): Promise<Scenario> {
    const blob = readBlob();
    const updated: Scenario = { ...scenario, updatedAt: new Date().toISOString() };
    const index = blob.scenarios.findIndex((s) => s.id === scenario.id);
    if (index >= 0) {
      blob.scenarios[index] = updated;
    } else {
      blob.scenarios.push(updated);
    }
    writeBlob({ ...blob, exportedAt: new Date().toISOString() });
    return updated;
  }

  async deleteScenario(id: string): Promise<void> {
    const blob = readBlob();
    blob.scenarios = blob.scenarios.filter((s) => s.id !== id);
    blob.overrides = blob.overrides.filter((o) => o.scenarioId !== id);
    writeBlob(blob);
  }

  async listOverrides(scenarioId: string): Promise<GridOverride[]> {
    return readBlob().overrides.filter((o) => o.scenarioId === scenarioId);
  }

  async saveOverride(override: GridOverride): Promise<GridOverride> {
    const blob = readBlob();
    const index = blob.overrides.findIndex(
      (o) =>
        o.id === override.id ||
        (o.scenarioId === override.scenarioId && o.personId === override.personId && o.year === override.year && o.field === override.field),
    );
    if (index >= 0) {
      blob.overrides[index] = override;
    } else {
      blob.overrides.push(override);
    }
    writeBlob(blob);
    return override;
  }

  async deleteOverride(id: string): Promise<void> {
    const blob = readBlob();
    blob.overrides = blob.overrides.filter((o) => o.id !== id);
    writeBlob(blob);
  }

  async exportScenarios(ids: string[]): Promise<ExportBundle> {
    const blob = readBlob();
    const idSet = new Set(ids);
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      scenarios: blob.scenarios.filter((s) => idSet.has(s.id)),
      overrides: blob.overrides.filter((o) => idSet.has(o.scenarioId)),
    };
  }

  async importAll(bundle: ExportBundle, mode: 'merge' | 'replace'): Promise<void> {
    if (mode === 'replace') {
      writeBlob({ ...bundle, exportedAt: new Date().toISOString() });
      return;
    }

    const existing = readBlob();

    const mergedScenarios = [...existing.scenarios];
    for (const scenario of bundle.scenarios) {
      const index = mergedScenarios.findIndex((s) => s.id === scenario.id);
      if (index >= 0) mergedScenarios[index] = scenario;
      else mergedScenarios.push(scenario);
    }

    const mergedOverrides = [...existing.overrides];
    for (const override of bundle.overrides) {
      const index = mergedOverrides.findIndex((o) => o.id === override.id);
      if (index >= 0) mergedOverrides[index] = override;
      else mergedOverrides.push(override);
    }

    writeBlob({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      scenarios: mergedScenarios,
      overrides: mergedOverrides,
    });
  }
}
