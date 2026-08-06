import { createContext } from 'react';

export interface SelectedPersonContextValue {
  /** null until a person has been picked (or when the scenario has no persons yet). */
  selectedPersonId: string | null;
  setSelectedPersonId: (id: string | null) => void;
  /** When true, the views show every person's figures summed, using the selected person as the row axis. */
  combined: boolean;
  setCombined: (combined: boolean) => void;
}

export const SelectedPersonContext = createContext<SelectedPersonContextValue | null>(null);
