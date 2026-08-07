import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalStorageScenarioRepository } from './localStorageScenarioRepository';

/** Node's test environment has no global `localStorage` - a minimal in-memory stand-in is enough for the repository's get/set/remove calls. */
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('first-run demo seeding', () => {
  it('seeds three demo scenarios when localStorage has never been written to', async () => {
    const scenarios = await new LocalStorageScenarioRepository().listScenarios();
    expect(scenarios).toHaveLength(3);
  });

  // Which scenario becomes ACTIVE is ActiveScenarioProvider's job, not the
  // repository's - it falls back to the first scenario reactively once this
  // data loads, since a direct localStorage write from this layer can never
  // reach a component that already read that key at mount. See
  // ActiveScenarioProvider.tsx.

  it('persists the seeded scenarios so re-reading returns the same ids rather than minting new ones', async () => {
    const first = await new LocalStorageScenarioRepository().listScenarios();
    const second = await new LocalStorageScenarioRepository().listScenarios();
    expect(second.map((s) => s.id)).toEqual(first.map((s) => s.id));
  });

  it('does not reseed once the user has deleted every scenario', async () => {
    const repo = new LocalStorageScenarioRepository();
    const seeded = await repo.listScenarios();
    for (const scenario of seeded) await repo.deleteScenario(scenario.id);

    const afterDelete = await new LocalStorageScenarioRepository().listScenarios();
    expect(afterDelete).toEqual([]);
  });

  it('leaves an already-populated store untouched', async () => {
    const repo = new LocalStorageScenarioRepository();
    const [seeded] = await repo.listScenarios();
    await repo.deleteScenario(seeded.id);

    const remaining = await new LocalStorageScenarioRepository().listScenarios();
    expect(remaining).toHaveLength(2);
  });
});
