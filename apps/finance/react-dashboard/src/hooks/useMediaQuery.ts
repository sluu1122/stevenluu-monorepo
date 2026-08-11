import { useCallback, useSyncExternalStore } from 'react';

/**
 * Subscribes to a CSS media query.
 *
 * `useSyncExternalStore` rather than the usual `useState` + `useEffect` pair:
 * the effect version renders once with a guessed default and only corrects on
 * the second pass, which for a layout-switching query means visibly mounting
 * the wrong view first. Reading `matches` in getSnapshot makes the very first
 * render correct.
 *
 * No `typeof window` guard - this is a client-only Vite SPA with no SSR pass,
 * and `ThemeProvider` already calls `window.matchMedia` unguarded.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    // Server snapshot is unreachable here, but React demands it be a stable
    // value rather than a fresh matchMedia read.
    () => false,
  );
}

/**
 * The one breakpoint the app branches on in JS. Expressed as `min-width` so it
 * reads the same direction as Tailwind's mobile-first prefixes, and matches
 * `lg:` (1024px) so the Planning Grid's table/card swap lands on the same line
 * as the sidebar's rail/drawer swap and `PlanningGridTab`'s `lg:flex-row`.
 */
export function useIsMobile(): boolean {
  return !useMediaQuery('(min-width: 1024px)');
}
