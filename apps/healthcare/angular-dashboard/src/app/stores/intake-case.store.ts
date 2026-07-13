import { computed, inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { catchError, tap, throwError, type Observable } from 'rxjs';
import { IntakeCaseService } from '../services/intake-case.service';
import { errorMessage } from '../shared/api-error';
import type { IntakeCase, Demographics, InsuranceInput, NoteInput } from '../models/intake.model';

interface IntakeCaseState {
  currentPatientId: string | null;
  intakeCase: IntakeCase | null;
  loading: boolean;
  error: string;
}

const initialState: IntakeCaseState = {
  currentPatientId: null,
  intakeCase: null,
  loading: false,
  error: '',
};

export const IntakeCaseStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed((store) => ({
    demographics: computed(() => store.intakeCase()?.demographics ?? null),
    insurances:   computed(() => store.intakeCase()?.insurances ?? []),
    notes:        computed(() => store.intakeCase()?.notes ?? []),
    documents:    computed(() => store.intakeCase()?.documents ?? []),
    history:      computed(() => store.intakeCase()?.history ?? []),
    trackerSteps: computed(() => store.intakeCase()?.trackerSteps ?? []),
  })),

  withMethods((store, intakeCaseService = inject(IntakeCaseService)) => {
    // Guards against a late response for a patient the user has since navigated away from.
    function withPatch(patientId: string, request: Observable<IntakeCase>, failMsg: string): Observable<IntakeCase> {
      return request.pipe(
        tap((intakeCase) => {
          if (store.currentPatientId() === patientId) patchState(store, { intakeCase });
        }),
        catchError((err) => throwError(() => new Error(errorMessage(err, failMsg)))),
      );
    }

    function load(patientId: string): void {
      patchState(store, { loading: true, error: '', currentPatientId: patientId });
      intakeCaseService.getIntakeCase(patientId).subscribe({
        next: (intakeCase) => {
          if (store.currentPatientId() === patientId) patchState(store, { intakeCase, loading: false });
        },
        error: (err) => {
          if (store.currentPatientId() !== patientId) return;
          patchState(store, { loading: false, error: errorMessage(err, 'Failed to load intake case. Please retry.') });
        },
      });
    }

    return {
      selectPatient(patientId: string): void {
        if (patientId === store.currentPatientId() && store.intakeCase() !== null) return;
        load(patientId);
      },
      loadCase(): void {
        const patientId = store.currentPatientId();
        if (patientId) load(patientId);
      },
      saveDemographics(demographics: Demographics): Observable<IntakeCase> {
        const patientId = store.currentPatientId()!;
        return withPatch(patientId, intakeCaseService.updateDemographics(patientId, demographics), 'Failed to save demographics.');
      },
      addInsurance(insurance: InsuranceInput): Observable<IntakeCase> {
        const patientId = store.currentPatientId()!;
        return withPatch(patientId, intakeCaseService.addInsurance(patientId, insurance), 'Failed to add insurance.');
      },
      updateInsurance(id: string, insurance: InsuranceInput): Observable<IntakeCase> {
        const patientId = store.currentPatientId()!;
        return withPatch(patientId, intakeCaseService.updateInsurance(patientId, id, insurance), 'Failed to update insurance.');
      },
      deleteInsurance(id: string): Observable<IntakeCase> {
        const patientId = store.currentPatientId()!;
        return withPatch(patientId, intakeCaseService.deleteInsurance(patientId, id), 'Failed to delete insurance.');
      },
      addNote(note: NoteInput): Observable<IntakeCase> {
        const patientId = store.currentPatientId()!;
        return withPatch(patientId, intakeCaseService.addNote(patientId, note), 'Failed to add note.');
      },
    };
  }),
);
