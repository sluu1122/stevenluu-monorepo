import { CURRENT_SCHEMA_VERSION, ExportBundleSchema } from '../engine/schema';
import type { ExportBundle, GridOverride, Scenario } from '../engine/schema';
import type { ScenarioRepository } from './types';
import { generateId } from '../engine/id';

const STORAGE_KEY = 'retirement-planner:v1';

function emptyBundle(): ExportBundle {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, exportedAt: new Date().toISOString(), scenarios: [], overrides: [] };
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

/** Exported so the JSON-import path (exportImport.ts) can apply the same migration to an uploaded backup file, not just LocalStorage reads. */
export function migrateStorageBlob(raw: unknown, fromVersion: number): unknown {
  void fromVersion; // migration is structurally self-detecting, see migrateScenarioV1ToV2
  if (typeof raw !== 'object' || raw === null || !('scenarios' in raw) || !Array.isArray((raw as { scenarios: unknown }).scenarios)) {
    return raw;
  }
  const bundle = raw as { scenarios: unknown[] };
  const migratedScenarios = bundle.scenarios.map((s) => (typeof s === 'object' && s !== null ? migrateScenarioV1ToV2(s as Record<string, unknown>) : s));
  return { ...raw, scenarios: migratedScenarios, schemaVersion: CURRENT_SCHEMA_VERSION };
}

function readBlob(): ExportBundle {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyBundle();

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
      (o) => o.id === override.id || (o.scenarioId === override.scenarioId && o.year === override.year && o.field === override.field),
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

  async exportAll(): Promise<ExportBundle> {
    return { ...readBlob(), exportedAt: new Date().toISOString() };
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
