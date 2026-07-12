import { computed, inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, withHooks, patchState } from '@ngrx/signals';
import { TimeoutError } from 'rxjs';
import { PatientService } from '../services/patient.service';
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
          || p.facility.toLowerCase().includes(q) || p.payer.toLowerCase().includes(q);
        return okStatus && okSearch;
      });
    }),

    statusCounts: computed(() => {
      const counts = { registered: 0, pending: 0, authorized: 0, payment: 0 };
      for (const p of store.inProgressPatients()) {
        if      (p.status === 'Registered')     counts.registered++;
        else if (p.status === 'Pending')        counts.pending++;
        else if (p.status === 'Authorized')     counts.authorized++;
        else if (p.status === 'Payment Posted') counts.payment++;
      }
      return counts;
    }),

    totalActive: computed(() => store.inProgressPatients().length),
  })),

  withMethods((store, patientService = inject(PatientService)) => ({
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
          const msg = err instanceof TimeoutError
            ? 'Request timed out. Check that patients-api is running.'
            : 'Failed to load patients. Please retry.';
          patchState(store, { loading: false, error: msg });
        },
      });
    },
    setNav(nav: NavView) { patchState(store, { activeNav: nav }); },
    setTab(tab: WorklistTab) { patchState(store, { worklistTab: tab, search: '', statusFilter: 'All' }); },
    setSearch(search: string) { patchState(store, { search }); },
    setStatusFilter(statusFilter: PatientStatus | 'All') { patchState(store, { statusFilter }); },
    clearFilters() { patchState(store, { search: '', statusFilter: 'All' }); },
  })),

  withHooks({
    onInit(store) { store.loadPatients(); },
  }),
);
