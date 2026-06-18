import { computed } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import type { AuthType, Determination, ModalKind } from '../models/patient.model';

interface WizardState {
  wizardOpen: boolean;
  activeStep: 1 | 2 | 3;
  authType: AuthType;
  determination: Determination;
  modalKind: ModalKind;
}

const initialState: WizardState = {
  wizardOpen: false,
  activeStep: 1,
  authType: 'Inpatient',
  determination: 'Pending',
  modalKind: undefined,
};

export const IntakeWizardStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed((store) => ({
    progressWidth: computed(() => {
      const map: Record<number, string> = { 1: '0%', 2: '50%', 3: '100%' };
      return map[store.activeStep()] ?? '0%';
    }),
    continueLabel: computed(() => store.activeStep() === 3 ? 'Submit' : 'Continue'),
    backDisabled:  computed(() => store.activeStep() === 1),
  })),

  withMethods((store) => ({
    openWizard()  { patchState(store, { wizardOpen: true, activeStep: 1 }); },
    closeWizard() { patchState(store, { wizardOpen: false }); },
    nextStep() {
      const cur = store.activeStep();
      if (cur < 3) patchState(store, { activeStep: (cur + 1) as 1 | 2 | 3 });
    },
    prevStep() {
      const cur = store.activeStep();
      if (cur > 1) patchState(store, { activeStep: (cur - 1) as 1 | 2 | 3 });
    },
    goToStep(step: number) { patchState(store, { activeStep: step as 1 | 2 | 3 }); },
    setAuthType(authType: AuthType) { patchState(store, { authType }); },
    setDetermination(determination: Determination) { patchState(store, { determination }); },
    openModal(kind: ModalKind)  { patchState(store, { modalKind: kind }); },
    closeModal()                { patchState(store, { modalKind: undefined }); },
  })),
);
