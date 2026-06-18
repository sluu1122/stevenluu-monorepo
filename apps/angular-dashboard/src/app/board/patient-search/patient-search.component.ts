import { Component, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { DIRECTORY } from '../../data/seed';
import type { DirectoryRecord, DirStatus } from '../../models/patient.model';

const PAYERS = ['All', ...Array.from(new Set(DIRECTORY.map(r => r.payer))).sort()];

@Component({
  selector: 'app-patient-search',
  standalone: true,
  imports: [FormsModule, TableModule, StatusBadgeComponent, AvatarComponent],
  templateUrl: './patient-search.component.html',
  styleUrl: './patient-search.component.scss',
})
export class PatientSearchComponent {
  protected query  = signal('');
  protected status = signal<DirStatus | 'All'>('All');
  protected payer  = signal('All');

  protected readonly STATUS_OPTIONS: (DirStatus | 'All')[] = ['All', 'Active', 'Admitted', 'Discharged'];
  protected readonly PAYER_OPTIONS = PAYERS;
  protected readonly total = DIRECTORY.length;

  protected readonly results = computed(() => {
    const q  = this.query().trim().toLowerCase();
    const st = this.status();
    const py = this.payer();

    return DIRECTORY.filter(r => {
      const okStatus = st === 'All' || r.status === st;
      const okPayer  = py === 'All' || r.payer === py;
      const okSearch = !q
        || r.name.toLowerCase().includes(q)
        || r.mrn.toLowerCase().includes(q)
        || r.dob.includes(q)
        || r.phone.includes(q);
      return okStatus && okPayer && okSearch;
    });
  });

  protected readonly hasFilters = computed(() =>
    this.query().trim() !== '' || this.status() !== 'All' || this.payer() !== 'All'
  );

  protected clearFilters(): void {
    this.query.set('');
    this.status.set('All');
    this.payer.set('All');
  }

  protected trackByMrn(_: number, r: DirectoryRecord): string { return r.mrn; }
}
