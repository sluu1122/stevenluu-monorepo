import { computed, inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, withHooks, patchState } from '@ngrx/signals';
import { PatientService } from '../services/patient.service';
import { errorMessage } from '../shared/api-error';
import type { Patient, NavView, WorklistTab, PatientStatus } from '../models/patient.model';

interface DashboardState {
  activeNav: NavView;
  worklistTab: WorklistTab;
  search: string;
  statusFilter: PatientStatus | 'All';
  inProgressPatients: Patient[];
  completedPatients: Patient[];
  loading: boolean;
  error: string;
}

const initialState: DashboardState = {
  activeNav: 'Worklist',
  worklistTab: 'In Progress',
  search: '',
  statusFilter: 'All',
  inProgressPatients: [],
  completedPatients:  [],
  loading: false,
  error: '',
};

export const DashboardStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed((store) => ({
    filteredPatients: computed(() => {
      const isCompleted = store.worklistTab() === 'Completed';
      const pool = isCompleted ? store.completedPatients() : store.inProgressPatients();
      const q  = store.search().trim().toLowerCase();
      const sf = store.statusFilter();

      return pool.filter(p => {
        const okStatus = isCompleted || sf === 'All' || p.status === sf;
        const okSearch = !q || p.id.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
          || p.facility.toLowerCase().includes(q) || p.payor.toLowerCase().includes(q);
        return okStatus && okSearch;
      });
    }),

    statusCounts: computed(() => {
      const counts = { pending: 0, received: 0, accepted: 0, scheduled: 0 };
      for (const p of store.inProgressPatients()) {
        if      (p.status === 'Pending')   counts.pending++;
        else if (p.status === 'Received')  counts.received++;
        else if (p.status === 'Accepted')  counts.accepted++;
        else if (p.status === 'Scheduled') counts.scheduled++;
      }
      return counts;
    }),

    totalActive: computed(() => store.inProgressPatients().length),
  })),

  withMethods((store, patientService = inject(PatientService)) => {
    // Replace the patient in place when it's already in its target list (keeps row
    // order stable on edits like assigning a provider); append only when it's new
    // to that list (a brand-new patient, or one whose status moved it across lists).
    const upsert = (patient: Patient) => {
      const replaceOrAppend = (list: Patient[]) => {
        const idx = list.findIndex(p => p.id === patient.id);
        if (idx === -1) return [...list, patient];
        const next = [...list];
        next[idx] = patient;
        return next;
      };

      if (patient.status === 'Completed') {
        patchState(store, {
          completedPatients:  replaceOrAppend(store.completedPatients()),
          inProgressPatients: store.inProgressPatients().filter(p => p.id !== patient.id),
        });
      } else {
        patchState(store, {
          inProgressPatients: replaceOrAppend(store.inProgressPatients()),
          completedPatients:  store.completedPatients().filter(p => p.id !== patient.id),
        });
      }
    };

    return {
      loadPatients(): void {
        patchState(store, { loading: true, error: '' });
        patientService.getPatients().subscribe({
          next: (patients) => {
            patchState(store, {
              inProgressPatients: patients.filter(p => p.status !== 'Completed'),
              completedPatients:  patients.filter(p => p.status === 'Completed'),
              loading: false,
            });
          },
          error: (err) => {
            patchState(store, { loading: false, error: errorMessage(err, 'Failed to load patients. Please retry.') });
          },
        });
      },
      upsertPatient(patient: Patient) { upsert(patient); },
      assignProvider(id: string, assignee: string) {
        patientService.assignPatient(id, assignee).subscribe({
          next: (patient) => upsert(patient),
          error: (err) => patchState(store, { error: errorMessage(err, 'Failed to assign provider. Please retry.') }),
        });
      },
      setNav(nav: NavView) { patchState(store, { activeNav: nav }); },
      setTab(tab: WorklistTab) { patchState(store, { worklistTab: tab, search: '', statusFilter: 'All' }); },
      setSearch(search: string) { patchState(store, { search }); },
      setStatusFilter(statusFilter: PatientStatus | 'All') { patchState(store, { statusFilter }); },
      clearFilters() { patchState(store, { search: '', statusFilter: 'All' }); },
    };
  }),

  withHooks({
    onInit(store) { store.loadPatients(); },
  }),
);
