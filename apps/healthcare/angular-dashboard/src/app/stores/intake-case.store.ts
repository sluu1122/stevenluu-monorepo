import { computed, inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, withHooks, patchState } from '@ngrx/signals';
import { TimeoutError, catchError, tap, throwError, type Observable } from 'rxjs';
import { IntakeCaseService } from '../services/intake-case.service';
import type { IntakeCase, Demographics, InsuranceInput, NoteInput } from '../models/intake.model';

interface IntakeCaseState {
  intakeCase: IntakeCase | null;
  loading: boolean;
  error: string;
}

const initialState: IntakeCaseState = {
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

    return {
      loadCase(): void {
        patchState(store, { loading: true, error: '' });
        intakeCaseService.getIntakeCase().subscribe({
          next: (intakeCase) => patchState(store, { intakeCase, loading: false }),
          error: (err) => patchState(store, {
            loading: false,
            error: errorMessage(err, 'Failed to load intake case. Please retry.'),
          }),
        });
      },
      saveDemographics(demographics: Demographics): Observable<IntakeCase> {
        return withPatch(intakeCaseService.updateDemographics(demographics), 'Failed to save demographics.');
      },
      addInsurance(insurance: InsuranceInput): Observable<IntakeCase> {
        return withPatch(intakeCaseService.addInsurance(insurance), 'Failed to add insurance.');
      },
      updateInsurance(id: string, insurance: InsuranceInput): Observable<IntakeCase> {
        return withPatch(intakeCaseService.updateInsurance(id, insurance), 'Failed to update insurance.');
      },
      deleteInsurance(id: string): Observable<IntakeCase> {
        return withPatch(intakeCaseService.deleteInsurance(id), 'Failed to delete insurance.');
      },
      addNote(note: NoteInput): Observable<IntakeCase> {
        return withPatch(intakeCaseService.addNote(note), 'Failed to add note.');
      },
    };
  }),

  withHooks({
    onInit(store) { store.loadCase(); },
  }),
);
