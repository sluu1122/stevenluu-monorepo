import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { DirectoryStore } from '../../stores/directory.store';
import type { DirectoryRecord, DirStatus } from '../../models/patient.model';

@Component({
  selector: 'app-patient-search',
  standalone: true,
  imports: [FormsModule, TableModule, ButtonModule, StatusBadgeComponent, AvatarComponent],
  templateUrl: './patient-search.component.html',
  styleUrl: './patient-search.component.scss',
})
export class PatientSearchComponent {
  protected readonly store = inject(DirectoryStore);

  protected query  = signal('');
  protected status = signal<DirStatus | 'All'>('All');
  protected payer  = signal('All');

  protected readonly STATUS_OPTIONS: (DirStatus | 'All')[] = ['All', 'Active', 'Admitted', 'Discharged'];

  protected readonly results = computed(() => {
    const q  = this.query().trim().toLowerCase();
    const st = this.status();
    const py = this.payer();

    return this.store.records().filter(r => {
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
