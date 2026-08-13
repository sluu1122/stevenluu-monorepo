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

describe('reset to demo scenarios', () => {
  /** A scenario of the user's own, distinguishable from the seeded demos. */
  async function addOwnScenario(repo: LocalStorageScenarioRepository, name: string) {
    const [template] = await repo.listScenarios();
    return repo.saveScenario({ ...template, id: `scenario-${name}`, name });
  }

  it('replaces everything with a fresh set of three demos when nothing is kept', async () => {
    const repo = new LocalStorageScenarioRepository();
    await addOwnScenario(repo, 'Mine');

    await repo.resetToDemoScenarios([]);

    const after = await repo.listScenarios();
    expect(after).toHaveLength(3);
    expect(after.map((s) => s.name)).not.toContain('Mine');
  });

  it('mints new ids rather than restoring the previous demo objects', async () => {
    const repo = new LocalStorageScenarioRepository();
    const before = await repo.listScenarios();

    await repo.resetToDemoScenarios([]);

    const after = await repo.listScenarios();
    expect(after.map((s) => s.id)).not.toEqual(before.map((s) => s.id));
  });

  it('spares a kept scenario and orders it ahead of the demos', async () => {
    const repo = new LocalStorageScenarioRepository();
    await addOwnScenario(repo, 'Mine');

    await repo.resetToDemoScenarios(['scenario-Mine']);

    const after = await repo.listScenarios();
    expect(after).toHaveLength(4);
    // First, so ActiveScenarioProvider's fallback lands on the user's own
    // scenario rather than a demo.
    expect(after[0].name).toBe('Mine');
  });

  it('keeps the overrides belonging to a kept scenario and drops the rest', async () => {
    const repo = new LocalStorageScenarioRepository();
    const [demo] = await repo.listScenarios();
    const mine = await addOwnScenario(repo, 'Mine');

    const override = (scenarioId: string, id: string) => ({
      id,
      scenarioId,
      personId: 'person-1',
      year: 2040,
      field: 'spendingNominal' as const,
      value: 50_000,
      createdAt: new Date().toISOString(),
    });
    await repo.saveOverride(override(mine.id, 'override-mine'));
    await repo.saveOverride(override(demo.id, 'override-demo'));

    await repo.resetToDemoScenarios([mine.id]);

    expect(await repo.listOverrides(mine.id)).toHaveLength(1);
    expect(await repo.listOverrides(demo.id)).toEqual([]);
  });

  it('still produces the demos when resetting an empty store', async () => {
    const repo = new LocalStorageScenarioRepository();
    for (const scenario of await repo.listScenarios()) await repo.deleteScenario(scenario.id);
    expect(await repo.listScenarios()).toEqual([]);

    await repo.resetToDemoScenarios([]);

    expect(await repo.listScenarios()).toHaveLength(3);
  });

  it('ignores ids that no longer exist instead of resurrecting them', async () => {
    const repo = new LocalStorageScenarioRepository();

    await repo.resetToDemoScenarios(['scenario-that-was-deleted']);

    expect(await repo.listScenarios()).toHaveLength(3);
  });
});

describe('reorderScenarios', () => {
  it('persists a new order, so it survives a reload', async () => {
    const repository = new LocalStorageScenarioRepository();
    const before = await repository.listScenarios();
    const reversed = [...before].reverse().map((s) => s.id);

    await repository.reorderScenarios(reversed);

    // Read through a fresh repository, which re-reads the stored blob rather
    // than any in-memory state - the point of the method is that it persists.
    const after = await new LocalStorageScenarioRepository().listScenarios();
    expect(after.map((s) => s.id)).toEqual(reversed);
    expect(after).toHaveLength(before.length);
  });

  it('keeps a scenario the caller did not know about instead of dropping it', async () => {
    const repository = new LocalStorageScenarioRepository();
    const before = await repository.listScenarios();

    // A list rendered before the third scenario existed - which is what a race
    // with an import, a duplicate, or another tab actually looks like.
    await repository.reorderScenarios([before[1].id, before[0].id]);

    const after = await repository.listScenarios();
    expect(after.map((s) => s.id)).toEqual([before[1].id, before[0].id, before[2].id]);
  });

  it('does not disturb the stored overrides', async () => {
    const repository = new LocalStorageScenarioRepository();
    const scenarios = await repository.listScenarios();
    const overridesBefore = await repository.listOverrides(scenarios[0].id);

    await repository.reorderScenarios([...scenarios].reverse().map((s) => s.id));

    expect(await repository.listOverrides(scenarios[0].id)).toEqual(overridesBefore);
  });
});
