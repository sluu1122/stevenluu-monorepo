import { inject } from '@angular/core';
import { signalStore, withState, withMethods, withHooks, patchState } from '@ngrx/signals';
import { AppContextService } from '../services/app-context.service';
import { errorMessage } from '../shared/api-error';
import type { AuthType, InsuranceRank } from '../models/patient.model';

interface ReferenceState {
  payers: string[];
  planTypes: string[];
  authTypes: AuthType[];
  noteCategories: string[];
  insuranceRanks: InsuranceRank[];
  loading: boolean;
  error: string;
}

const initialState: ReferenceState = {
  payers: [],
  planTypes: [],
  authTypes: [],
  noteCategories: [],
  insuranceRanks: [],
  loading: false,
  error: '',
};

export const ReferenceStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withMethods((store, appContext = inject(AppContextService)) => ({
    loadReference(): void {
      patchState(store, { loading: true, error: '' });
      appContext.getReference().subscribe({
        next: (ref) => patchState(store, { ...ref, loading: false }),
        error: (err) => {
          patchState(store, { loading: false, error: errorMessage(err, 'Failed to load reference data.') });
        },
      });
    },
  })),

  withHooks({
    onInit(store) { store.loadReference(); },
  }),
);
