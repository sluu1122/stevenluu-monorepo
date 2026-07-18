import { Component, inject, computed } from '@angular/core';
import { DashboardStore } from '../../../stores/dashboard.store';
import type { PatientStatus } from '../../../models/patient.model';

type StatusFilter = PatientStatus | 'All';

interface StatusTile {
  label: string;
  count: number;
  dot: string;
  status: StatusFilter;
}

@Component({
  selector: 'app-wl-status-tiles',
  standalone: true,
  imports: [],
  templateUrl: './status-tiles.component.html',
  styleUrl: './status-tiles.component.scss',
})
export class StatusTilesComponent {
  protected readonly store = inject(DashboardStore);

  protected readonly statusTiles = computed<StatusTile[]>(() => {
    const counts = this.store.statusCounts();
    return [
      { label: 'Pending',   count: counts.pending,   dot: '#94a3b8', status: 'Pending' },
      { label: 'Received',  count: counts.received,  dot: '#d68a2c', status: 'Received' },
      { label: 'Accepted',  count: counts.accepted,  dot: '#2a6fdb', status: 'Accepted' },
      { label: 'Scheduled', count: counts.scheduled, dot: '#10a08a', status: 'Scheduled' },
    ];
  });

  protected toggleStatus(status: StatusFilter): void {
    this.store.setStatusFilter(this.store.statusFilter() === status ? 'All' : status);
  }
}
