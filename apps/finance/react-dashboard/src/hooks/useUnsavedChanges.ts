import { useContext } from 'react';
import { UnsavedChangesContext } from '../providers/unsaved-changes-context';

export function useUnsavedChanges() {
  const ctx = useContext(UnsavedChangesContext);
  if (!ctx) throw new Error('useUnsavedChanges must be used within an UnsavedChangesProvider');
  return ctx;
}
