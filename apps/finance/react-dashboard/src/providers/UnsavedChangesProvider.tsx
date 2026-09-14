import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { UnsavedChangesContext } from './unsaved-changes-context';

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Covers the exits React can't intercept - closing the tab, reloading,
  // following a link out. The browser shows its own generic wording here; the
  // string is ignored by every current browser but returning one is still what
  // triggers the prompt in some of them.
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsavedChanges]);

  const value = useMemo(() => ({ hasUnsavedChanges, setHasUnsavedChanges }), [hasUnsavedChanges]);
  return <UnsavedChangesContext.Provider value={value}>{children}</UnsavedChangesContext.Provider>;
}
