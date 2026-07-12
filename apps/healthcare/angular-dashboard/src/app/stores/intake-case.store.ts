import { computed, inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { TimeoutError, catchError, tap, throwError, type Observable } from 'rxjs';
import { IntakeCaseService } from '../services/intake-case.service';
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

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof TimeoutError
    ? 'Request timed out. Check that patients-api is running.'
    : fallback;
}

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
    function withPatch(request: Observable<IntakeCase>, failMsg: string): Observable<IntakeCase> {
      return request.pipe(
        tap((intakeCase) => patchState(store, { intakeCase })),
        catchError((err) => throwError(() => new Error(errorMessage(err, failMsg)))),
      );
    }

    function load(patientId: string): void {
      patchState(store, { loading: true, error: '', currentPatientId: patientId });
      intakeCaseService.getIntakeCase(patientId).subscribe({
        next: (intakeCase) => patchState(store, { intakeCase, loading: false }),
        error: (err) => patchState(store, {
          loading: false,
          error: errorMessage(err, 'Failed to load intake case. Please retry.'),
        }),
      });
    }

    return {
      selectPatient(patientId: string): void {
        load(patientId);
      },
      loadCase(): void {
        const patientId = store.currentPatientId();
        if (patientId) load(patientId);
      },
      saveDemographics(demographics: Demographics): Observable<IntakeCase> {
        return withPatch(intakeCaseService.updateDemographics(store.currentPatientId()!, demographics), 'Failed to save demographics.');
      },
      addInsurance(insurance: InsuranceInput): Observable<IntakeCase> {
        return withPatch(intakeCaseService.addInsurance(store.currentPatientId()!, insurance), 'Failed to add insurance.');
      },
      updateInsurance(id: string, insurance: InsuranceInput): Observable<IntakeCase> {
        return withPatch(intakeCaseService.updateInsurance(store.currentPatientId()!, id, insurance), 'Failed to update insurance.');
      },
      deleteInsurance(id: string): Observable<IntakeCase> {
        return withPatch(intakeCaseService.deleteInsurance(store.currentPatientId()!, id), 'Failed to delete insurance.');
      },
      addNote(note: NoteInput): Observable<IntakeCase> {
        return withPatch(intakeCaseService.addNote(store.currentPatientId()!, note), 'Failed to add note.');
      },
    };
  }),
);
