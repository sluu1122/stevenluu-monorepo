import { Component, inject, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { BoardStore } from '../../stores/board.store';
import { IntakeWizardStore } from '../../stores/intake-wizard.store';
import { WizardModalComponent } from '../wizard-modal/wizard-modal.component';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import type { PatientStatus, WorklistTab } from '../../models/patient.model';

interface KpiTile {
  label: string;
  count: number;
  dot: string;
  status: PatientStatus | 'All';
}

@Component({
  selector: 'app-worklist',
  standalone: true,
  imports: [FormsModule, TableModule, WizardModalComponent, StatusBadgeComponent, AvatarComponent],
  templateUrl: './worklist.component.html',
  styleUrl: './worklist.component.scss',
})
export class WorklistComponent {
  protected readonly board  = inject(BoardStore);
  protected readonly wizard = inject(IntakeWizardStore);

  protected readonly STATUS_OPTIONS: (PatientStatus | 'All')[] = [
    'All', 'Registered', 'Pending', 'Authorized', 'Payment Posted',
  ];

  protected readonly TABS: WorklistTab[] = ['In Progress', 'Completed'];

  protected readonly kpiTiles = computed<KpiTile[]>(() => {
    const counts = this.board.kpiCounts();
    return [
      { label: 'Registered',    count: counts.registered, dot: '#94a3b8', status: 'Registered' },
      { label: 'Pending',       count: counts.pending,    dot: '#d68a2c', status: 'Pending' },
      { label: 'Authorized',    count: counts.authorized, dot: '#2a6fdb', status: 'Authorized' },
      { label: 'Payment Posted',count: counts.payment,    dot: '#10a08a', status: 'Payment Posted' },
    ];
  });

  protected filterByKpi(status: PatientStatus | 'All'): void {
    this.board.setStatusFilter(status);
  }

  protected openWizard(): void { this.wizard.openWizard(); }
}
