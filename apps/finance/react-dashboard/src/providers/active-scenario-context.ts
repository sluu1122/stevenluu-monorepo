import { createContext } from 'react';

export interface ActiveScenarioContextValue {
  activeScenarioId: string | null;
  setActiveScenarioId: (id: string | null) => void;
}

export const ActiveScenarioContext = createContext<ActiveScenarioContextValue | null>(null);
