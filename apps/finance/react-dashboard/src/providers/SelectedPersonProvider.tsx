import { useEffect, useState, type ReactNode } from 'react';
import { SelectedPersonContext } from './selected-person-context';

const PERSON_KEY = 'retirement-planner:selected-person-id';
const COMBINED_KEY = 'retirement-planner:combine-persons';

/**
 * Which person the Planning Grid, Charts and Client Summary are showing -
 * held above all three so the choice follows the user across tabs rather
 * than resetting on every switch. Persisted the same way the active
 * scenario is (see ActiveScenarioProvider).
 */
export function SelectedPersonProvider({ children }: { children: ReactNode }) {
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(() => window.localStorage.getItem(PERSON_KEY));
  const [combined, setCombined] = useState(() => window.localStorage.getItem(COMBINED_KEY) === '1');

  useEffect(() => {
    if (selectedPersonId) window.localStorage.setItem(PERSON_KEY, selectedPersonId);
    else window.localStorage.removeItem(PERSON_KEY);
  }, [selectedPersonId]);

  useEffect(() => {
    window.localStorage.setItem(COMBINED_KEY, combined ? '1' : '0');
  }, [combined]);

  return (
    <SelectedPersonContext.Provider value={{ selectedPersonId, setSelectedPersonId, combined, setCombined }}>
      {children}
    </SelectedPersonContext.Provider>
  );
}
