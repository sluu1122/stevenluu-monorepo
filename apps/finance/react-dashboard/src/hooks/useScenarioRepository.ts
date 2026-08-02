import { LocalStorageScenarioRepository } from '../repository/localStorageScenarioRepository';
import type { ScenarioRepository } from '../repository/types';

// The one thing a future Postgres-backed implementation needs to replace.
const repository: ScenarioRepository = new LocalStorageScenarioRepository();

export function useScenarioRepository(): ScenarioRepository {
  return repository;
}
