import { useContext } from 'react';
import { ActiveScenarioContext } from '../providers/active-scenario-context';

export function useActiveScenario() {
  const ctx = useContext(ActiveScenarioContext);
  if (!ctx) throw new Error('useActiveScenario must be used within an ActiveScenarioProvider');
  return ctx;
}
