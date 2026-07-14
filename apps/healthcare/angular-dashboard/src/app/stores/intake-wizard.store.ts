import { computed, inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { Observable, Subscription, TimeoutError, catchError, tap, throwError } from 'rxjs';
import {
  ClinicalDecisionSupportService,
  MnResult,
  MnRequest,
} from '../services/clinical-decision-support.service';
import { PatientService } from '../services/patient.service';
import { DashboardStore } from './dashboard.store';
import { sexCode, sexLabel } from '../shared/sex';
import { errorMessage } from '../shared/api-error';
import type { DirectoryRecord, NewPatientInput, Patient } from '../models/patient.model';

export interface IntakeProcedure {
  id: string;
  text: string;
  cpts: string[];
}

export interface IntakeInsurance {
  id: string;
  payer: string;
  scopeAll: boolean;
  procIds: string[];
}

interface IntakeState {
  isOpen: boolean;
  activeStep: number;
  provisionalId: string;
  // Step 1 — Patient
  name: string;
  dob: string;
  sex: string;
  mrn: string;
  phone: string;
  email: string;
  // Step 2 — Diagnosis
  dxIcds: string[];
  dxText: string;
  // Step 3 — Procedures
  procedures: IntakeProcedure[];
  // Step 4 — Insurance & MN
  insurances: IntakeInsurance[];
  mnRun: boolean;
  mnPending: boolean;
  mnResults: MnResult[];
  mnError: string;
}

const initialState: IntakeState = {
  isOpen: false,
  activeStep: 1,
  provisionalId: '',
  name: '', dob: '', sex: '', mrn: '', phone: '', email: '',
  dxIcds: [], dxText: '',
  procedures: [{ id: 'p1', text: '', cpts: [] }],
  insurances: [{ id: 'w1', payer: 'Aetna', scopeAll: true, procIds: [] }],
  mnRun: false,
  mnPending: false,
  mnResults: [],
  mnError: '',
};

let _seq     = 1;
let _intakeN = 0;
function uid(prefix: string): string { return prefix + (++_seq); }
function nextIntakeId(): string { return `INT-${String(++_intakeN).padStart(5, '0')}`; }

export const RANK_NAMES = ['Primary Insurance', 'Secondary Insurance', 'Tertiary Insurance'];

export function procLabel(p: IntakeProcedure, i: number): string {
  return p.text.trim() || p.cpts[0] || `Procedure ${i + 1}`;
}

export const IntakeWizardStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed((store) => ({
    progressWidth:    computed(() => ((store.activeStep() - 1) / 4 * 80) + '%'),
    isMnChoice:       computed(() => store.activeStep() === 4 && !store.mnRun()),
    isReviewStep:     computed(() => store.activeStep() === 5),
    isNormalContinue: computed(() => store.activeStep() !== 5 && !(store.activeStep() === 4 && !store.mnRun())),
    continueLabel:    computed(() => store.activeStep() === 4 ? 'Continue to Review' : 'Save & Continue'),
    stepLabel:        computed(() => `Step ${store.activeStep()} of 5`),
    backDisabled:     computed(() => store.activeStep() === 1),
    canRunMn:         computed(() =>
      store.dxIcds().length > 0 &&
      store.procedures().some(p => p.cpts.length > 0)
    ),
  })),

  withMethods((store) => {
    const cds            = inject(ClinicalDecisionSupportService);
    const patientService = inject(PatientService);
    const dashboardStore = inject(DashboardStore);
    let mnSub: Subscription | null = null;

    return {
      open(prefill?: DirectoryRecord) {
        mnSub?.unsubscribe();
        mnSub = null;
        patchState(store, {
          isOpen: true, activeStep: 1,
          provisionalId: nextIntakeId(),
          mnRun: false, mnPending: false, mnResults: [], mnError: '',
          name:  prefill?.name ?? '',
          dob:   prefill?.dob ?? '',
          sex:   prefill ? sexLabel(prefill.sex) : '',
          mrn:   prefill?.mrn ?? '',
          phone: prefill?.phone ?? '',
          email: '',
          dxText: '', dxIcds: [],
          procedures: [{ id: 'p1', text: '', cpts: [] }],
          insurances: [{ id: 'w1', payer: prefill?.payer ?? 'Aetna', scopeAll: true, procIds: [] }],
        });
      },
      close()                { patchState(store, { isOpen: false }); },

      submit(): Observable<Patient> {
        const input: NewPatientInput = {
          name:  store.name(),
          dob:   store.dob(),
          sex:   sexCode(store.sex()),
          mrn:   store.mrn(),
          phone: store.phone(),
          email: store.email(),
          payer: store.insurances()[0]?.payer ?? 'Aetna',
          insurances: store.insurances().map(w => ({ payer: w.payer })),
        };
        return patientService.addPatient(input).pipe(
          tap(patient => dashboardStore.upsertPatient(patient)),
          catchError(err => throwError(() => new Error(errorMessage(err, 'Failed to submit intake.')))),
        );
      },

      goToStep(step: number) { patchState(store, { activeStep: step }); },
      nextStep()             { patchState(store, { activeStep: Math.min(5, store.activeStep() + 1) }); },
      prevStep()             { patchState(store, { activeStep: Math.max(1, store.activeStep() - 1) }); },

      // Step 1
      setPatientField(field: 'name' | 'dob' | 'sex' | 'mrn' | 'phone' | 'email', value: string) {
        patchState(store, { [field]: value });
      },
      setPatientFields(fields: Partial<Pick<IntakeState, 'name' | 'dob' | 'sex' | 'mrn' | 'phone' | 'email'>>) {
        patchState(store, fields);
      },

      // Step 2
      setDxText(dxText: string)   { patchState(store, { dxText }); },
      setDxIcds(dxIcds: string[]) { patchState(store, { dxIcds, mnRun: false, mnResults: [] }); },

      // Step 3
      addProcedure() {
        patchState(store, { procedures: [...store.procedures(), { id: uid('p'), text: '', cpts: [] }] });
      },
      removeProcedure(id: string) {
        patchState(store, {
          procedures: store.procedures().filter(p => p.id !== id),
          insurances: store.insurances().map(w => ({ ...w, procIds: w.procIds.filter(x => x !== id) })),
          mnRun: false, mnResults: [],
        });
      },
      setProcedureText(id: string, text: string) {
        patchState(store, { procedures: store.procedures().map(p => p.id === id ? { ...p, text } : p) });
      },
      setProcCpts(id: string, cpts: string[]) {
        patchState(store, {
          procedures: store.procedures().map(p => p.id === id ? { ...p, cpts } : p),
          mnRun: false, mnResults: [],
        });
      },

      // Step 4
      addInsurance() {
        patchState(store, {
          insurances: [...store.insurances(), { id: uid('w'), payer: 'Aetna', scopeAll: true, procIds: [] }],
          mnRun: false,
        });
      },
      removeInsurance(id: string) {
        patchState(store, { insurances: store.insurances().filter(w => w.id !== id) });
      },
      setInsurancePayer(id: string, payer: string) {
        patchState(store, {
          insurances: store.insurances().map(w => w.id === id ? { ...w, payer } : w),
          mnRun: false, mnResults: [],
        });
      },
      setInsuranceScope(id: string, scopeAll: boolean) {
        patchState(store, {
          insurances: store.insurances().map(w => w.id === id ? { ...w, scopeAll } : w),
          mnRun: false, mnResults: [],
        });
      },
      toggleInsuranceProcedure(id: string, procId: string) {
        patchState(store, {
          insurances: store.insurances().map(w => {
            if (w.id !== id) return w;
            const procIds = w.procIds.includes(procId)
              ? w.procIds.filter(x => x !== procId)
              : [...w.procIds, procId];
            return { ...w, procIds };
          }),
          mnRun: false, mnResults: [],
        });
      },

      runMedicalNecessity() {
        if (!store.dxIcds().length || !store.procedures().some(p => p.cpts.length > 0)) {
          patchState(store, { mnError: 'Add at least one ICD-10 code and one CPT code before running the check.' });
          return;
        }
        mnSub?.unsubscribe();
        patchState(store, { mnPending: true, mnError: '' });

        const req: MnRequest = {
          procedures: store.procedures().map(p => ({
            id:   p.id,
            cpts: p.cpts,
            ...(p.text.trim() && { text: p.text.trim() }),
          })),
          diagnosis: {
            icds: store.dxIcds(),
            ...(store.dxText().trim() && { text: store.dxText().trim() }),
          },
          insurances: store.insurances().map(w => ({
            id:    w.id,
            payer: w.payer,
            scope: w.scopeAll ? 'all' : w.procIds.length ? w.procIds.join(',') : 'none',
          })),
        };

        mnSub = cds.checkMedicalNecessity(req).subscribe({
          next:  results => patchState(store, { mnResults: results, mnPending: false, mnRun: true }),
          error: (err: Error) => patchState(store, {
            mnError: err instanceof TimeoutError
              ? 'Medical necessity check timed out — try again'
              : err.message || 'Medical necessity check failed',
            mnPending: false,
          }),
        });
      },

      skipMedicalNecessity() { patchState(store, { mnRun: false, activeStep: 5 }); },
    };
  }),
);
