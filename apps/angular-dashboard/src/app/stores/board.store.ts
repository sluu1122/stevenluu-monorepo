import { computed } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { ALL_PATIENTS } from '../data/seed';
import type { NavView, WorklistTab, PatientStatus } from '../models/patient.model';

interface BoardState {
  activeNav: NavView;
  worklistTab: WorklistTab;
  search: string;
  statusFilter: PatientStatus | 'All';
  // Pre-split at initialization — ALL_PATIENTS is static seed data, not a signal
  inProgressPatients: typeof ALL_PATIENTS;
  completedPatients: typeof ALL_PATIENTS;
}

const initialState: BoardState = {
  activeNav: 'Worklist',
  worklistTab: 'In Progress',
  search: '',
  statusFilter: 'All',
  inProgressPatients: ALL_PATIENTS.filter(p => p.status !== 'Completed'),
  completedPatients:  ALL_PATIENTS.filter(p => p.status === 'Completed'),
};

export const BoardStore = signalStore(
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
        const okSearch = !q || p.id.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
        return okStatus && okSearch;
      });
    }),

    kpiCounts: computed(() => {
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

  withMethods((store) => ({
    setNav(nav: NavView) { patchState(store, { activeNav: nav }); },
    setTab(tab: WorklistTab) { patchState(store, { worklistTab: tab, search: '', statusFilter: 'All' }); },
    setSearch(search: string) { patchState(store, { search }); },
    setStatusFilter(statusFilter: PatientStatus | 'All') { patchState(store, { statusFilter }); },
    clearFilters() { patchState(store, { search: '', statusFilter: 'All' }); },
  })),
);
