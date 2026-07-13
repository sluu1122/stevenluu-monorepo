import { computed, inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, withHooks, patchState } from '@ngrx/signals';
import { PatientService } from '../services/patient.service';
import { errorMessage } from '../shared/api-error';
import type { DirectoryRecord } from '../models/patient.model';

interface DirectoryState {
  records: DirectoryRecord[];
  loading: boolean;
  error: string;
}

const initialState: DirectoryState = {
  records: [],
  loading: false,
  error: '',
};

export const DirectoryStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed((store) => ({
    payerOptions: computed(() =>
      ['All', ...[...new Set(store.records().map(r => r.payer))].sort()]
    ),
    total: computed(() => store.records().length),
  })),

  withMethods((store, patientService = inject(PatientService)) => ({
    loadDirectory(): void {
      patchState(store, { loading: true, error: '' });
      patientService.getDirectory().subscribe({
        next: (records) => patchState(store, { records, loading: false }),
        error: (err) => {
          patchState(store, { loading: false, error: errorMessage(err, 'Failed to load patient directory. Please retry.') });
        },
      });
    },
  })),

  withHooks({
    onInit(store) { store.loadDirectory(); },
  }),
);
