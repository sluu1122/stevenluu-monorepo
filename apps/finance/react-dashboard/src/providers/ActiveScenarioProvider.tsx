import { useEffect, useState, type ReactNode } from 'react';
import { ActiveScenarioContext } from './active-scenario-context';
import { ACTIVE_SCENARIO_STORAGE_KEY as STORAGE_KEY } from '../lib/storageKeys';

export function ActiveScenarioProvider({ children }: { children: ReactNode }) {
  const [activeScenarioId, setActiveScenarioIdState] = useState<string | null>(() => window.localStorage.getItem(STORAGE_KEY));

  useEffect(() => {
    if (activeScenarioId) window.localStorage.setItem(STORAGE_KEY, activeScenarioId);
    else window.localStorage.removeItem(STORAGE_KEY);
  }, [activeScenarioId]);

  return (
    <ActiveScenarioContext.Provider value={{ activeScenarioId, setActiveScenarioId: setActiveScenarioIdState }}>
      {children}
    </ActiveScenarioContext.Provider>
  );
}
