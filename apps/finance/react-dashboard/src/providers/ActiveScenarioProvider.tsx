import { useEffect, useState, type ReactNode } from 'react';
import { ActiveScenarioContext } from './active-scenario-context';
import { ACTIVE_SCENARIO_STORAGE_KEY as STORAGE_KEY } from '../lib/storageKeys';
import { useScenarios } from '../hooks/useScenarios';

export function ActiveScenarioProvider({ children }: { children: ReactNode }) {
  const [activeScenarioId, setActiveScenarioIdState] = useState<string | null>(() => window.localStorage.getItem(STORAGE_KEY));
  const { data: scenarios } = useScenarios();

  useEffect(() => {
    if (activeScenarioId) window.localStorage.setItem(STORAGE_KEY, activeScenarioId);
    else window.localStorage.removeItem(STORAGE_KEY);
  }, [activeScenarioId]);

  // Falls back to the first available scenario once the list loads, if
  // nothing is active yet or the previously active id no longer refers to a
  // real scenario. This is what makes first-run demo seeding work: seeding
  // happens inside the repository's async listScenarios() call, which lands
  // well after this component's own synchronous localStorage read at mount -
  // writing the id directly to localStorage from the repository can never
  // reach this already-rendered provider's React state, only a reactive
  // update keyed off the scenario data itself can. Adjusted during render
  // (React's documented "adjusting state when a prop changes" pattern)
  // rather than in an effect, so there's no one-frame flash of the "create
  // your first scenario" empty state before this catches up.
  const [lastSeenScenarios, setLastSeenScenarios] = useState(scenarios);
  if (scenarios !== lastSeenScenarios) {
    setLastSeenScenarios(scenarios);
    if (scenarios && scenarios.length > 0) {
      const stillExists = activeScenarioId != null && scenarios.some((s) => s.id === activeScenarioId);
      if (!stillExists) setActiveScenarioIdState(scenarios[0].id);
    }
  }

  return (
    <ActiveScenarioContext.Provider value={{ activeScenarioId, setActiveScenarioId: setActiveScenarioIdState }}>
      {children}
    </ActiveScenarioContext.Provider>
  );
}
