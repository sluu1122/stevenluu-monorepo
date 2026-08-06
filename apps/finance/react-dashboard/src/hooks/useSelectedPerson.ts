import { useContext } from 'react';
import { SelectedPersonContext } from '../providers/selected-person-context';

export function useSelectedPerson() {
  const ctx = useContext(SelectedPersonContext);
  if (!ctx) throw new Error('useSelectedPerson must be used within a SelectedPersonProvider');
  return ctx;
}
