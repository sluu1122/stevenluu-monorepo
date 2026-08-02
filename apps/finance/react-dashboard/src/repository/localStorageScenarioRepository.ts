import { CURRENT_SCHEMA_VERSION, ExportBundleSchema } from '../engine/schema';
import type { ExportBundle, GridOverride, Scenario } from '../engine/schema';
import type { ScenarioRepository } from './types';

const STORAGE_KEY = 'retirement-planner:v1';

function emptyBundle(): ExportBundle {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, exportedAt: new Date().toISOString(), scenarios: [], overrides: [] };
}

/** No migrations exist yet - this is the seam for future CURRENT_SCHEMA_VERSION bumps. */
function migrateStorageBlob(raw: unknown, fromVersion: number): unknown {
  void fromVersion;
  return raw;
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
