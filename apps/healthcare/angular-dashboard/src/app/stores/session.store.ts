import { computed, inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, withHooks, patchState } from '@ngrx/signals';
import { AppContextService } from '../services/app-context.service';
import { errorMessage } from '../shared/api-error';
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
          patchState(store, { loading: false, error: errorMessage(err, 'Failed to load user session.') });
        },
      });
    },
  })),

  withHooks({
    onInit(store) { store.loadUser(); },
  }),
);
