import type { ExportBundle, GridOverride, Scenario } from '../engine/schema';

/**
 * All methods return Promise even though the LocalStorage implementation is
 * synchronous under the hood, so a future Postgres/REST implementation is a
 * drop-in swap with zero call-site changes.
 */
export interface ScenarioRepository {
  listScenarios(): Promise<Scenario[]>;
  getScenario(id: string): Promise<Scenario | null>;
  saveScenario(scenario: Scenario): Promise<Scenario>;
  deleteScenario(id: string): Promise<void>;
  listOverrides(scenarioId: string): Promise<GridOverride[]>;
  saveOverride(override: GridOverride): Promise<GridOverride>;
  deleteOverride(id: string): Promise<void>;
  /** Pass every scenario's id to export a full backup, or a subset for a partial one. */
  exportScenarios(ids: string[]): Promise<ExportBundle>;
  importAll(bundle: ExportBundle, mode: 'merge' | 'replace'): Promise<void>;
}
