import { DestroyRef, WritableSignal, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, TimeoutError, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, map, timeout } from 'rxjs/operators';
import { SEARCH_TIMEOUT_MS } from '../constants';

const MIN_QUERY_LEN = 2;

export interface CodeSearch<T> {
  searching: WritableSignal<boolean>;
  searchError: WritableSignal<string | null>;
  suggestionsFor(key: string): T[];
  query(key: string, q: string): void;
}

/** Debounced, cancel-safe typeahead against a code-lookup endpoint, keyed so a single instance can back multiple rows (e.g. one per procedure). */
export function createCodeSearch<T>(search: (q: string) => Observable<T[]>, label: string): CodeSearch<T> {
  const destroyRef = inject(DestroyRef);
  const query$ = new Subject<{ key: string; q: string }>();
  const suggestionsMap = signal<Record<string, T[]>>({});
  const searching = signal(false);
  const searchError = signal<string | null>(null);

  destroyRef.onDestroy(() => query$.complete());

  query$.pipe(
    debounceTime(250),
    distinctUntilChanged((a, b) => a.key === b.key && a.q === b.q),
    switchMap(({ key, q }) => {
      if (q.length < MIN_QUERY_LEN) return of({ key, results: [] as T[], error: null as string | null });
      searching.set(true);
      return search(q).pipe(
        timeout(SEARCH_TIMEOUT_MS),
        map(results => ({ key, results, error: null as string | null })),
        catchError((err: unknown) => of({
          key,
          results: [] as T[],
          error: err instanceof TimeoutError
            ? `${label} search timed out — try again`
            : `${label} lookup failed. Check your connection.`,
        })),
      );
    }),
    takeUntilDestroyed(destroyRef),
  ).subscribe(({ key, results, error }) => {
    searching.set(false);
    searchError.set(error);
    suggestionsMap.update(m => ({ ...m, [key]: results }));
  });

  return {
    searching,
    searchError,
    suggestionsFor: (key: string) => suggestionsMap()[key] ?? [],
    // Every query — including a cleared/empty one — flows through the debounced
    // stream so switchMap cancels any in-flight search; an empty or too-short
    // query resolves to no results instead of being special-cased locally.
    query(key: string, q: string) {
      query$.next({ key, q });
    },
  };
}
