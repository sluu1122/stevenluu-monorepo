import { computed, inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, withHooks, patchState } from '@ngrx/signals';
import { TimeoutError } from 'rxjs';
import { AppContextService } from '../services/app-context.service';
import { initialsOf } from '../shared/initials';
import type { CurrentUser } from '../models/app-context.model';

interface SessionState {
  user: CurrentUser | null;
  loading: boolean;
  error: string;
}

const initialState: SessionState = {
  user: null,
  loading: false,
  error: '',
};

export const SessionStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed((store) => ({
    userInitials: computed(() => initialsOf(store.user()?.name ?? '')),
  })),

  withMethods((store, appContext = inject(AppContextService)) => ({
    loadUser(): void {
      patchState(store, { loading: true, error: '' });
      appContext.getMe().subscribe({
        next: (user) => patchState(store, { user, loading: false }),
        error: (err) => {
          const msg = err instanceof TimeoutError
            ? 'Request timed out. Check that patients-api is running.'
            : 'Failed to load user session.';
          patchState(store, { loading: false, error: msg });
        },
      });
    },
  })),

  withHooks({
    onInit(store) { store.loadUser(); },
  }),
);
