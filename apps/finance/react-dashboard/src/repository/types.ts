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
  /**
   * Wipe stored scenarios back to a freshly-seeded set of demos, sparing the
   * ids in `keepIds` (and their overrides). Pass an empty array for a full
   * reset. Kept scenarios are ordered ahead of the demos so whichever one was
   * active is still likely to be picked up as the fallback.
   */
  resetToDemoScenarios(keepIds: string[]): Promise<void>;
}
