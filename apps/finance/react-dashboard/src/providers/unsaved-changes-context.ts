import { createContext } from 'react';

export interface UnsavedChangesContextValue {
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (dirty: boolean) => void;
}

/**
 * Whether the Scenario Setup form is holding edits that aren't in storage yet.
 *
 * Lives in a context because the component that KNOWS (the setup form) and the
 * component that can destroy them (the sidebar's scenario list, which resets
 * that form by switching the active scenario) are siblings with no other
 * relationship.
 */
export const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);
