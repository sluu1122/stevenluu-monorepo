import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DirectoryStore } from '../../stores/directory.store';
import { IntakeWizardStore } from '../../stores/intake-wizard.store';
import { DashboardStore } from '../../stores/dashboard.store';
import type { DirectoryRecord } from '../../models/patient.model';

@Component({
  selector: 'app-patient-search',
  standalone: true,
  imports: [FormsModule, TableModule, ButtonModule],
  templateUrl: './patient-search.component.html',
  styleUrl: './patient-search.component.scss',
})
export class PatientSearchComponent {
  protected readonly store  = inject(DirectoryStore);
  protected readonly intake = inject(IntakeWizardStore);
  private readonly dashboard = inject(DashboardStore);

  protected query = signal('');
  protected payor = signal('All');

  protected readonly results = computed(() => {
    const q  = this.query().trim().toLowerCase();
    const py = this.payor();

    return this.store.records().filter(r => {
      const okPayor  = py === 'All' || r.payor === py;
      const okSearch = !q
        || r.name.toLowerCase().includes(q)
        || r.mrn.toLowerCase().includes(q)
        || r.dob.includes(q)
        || r.phone.includes(q);
      return okPayor && okSearch;
    });
  });

  protected readonly hasFilters = computed(() =>
    this.query().trim() !== '' || this.payor() !== 'All'
  );

  protected clearFilters(): void {
    this.query.set('');
    this.payor.set('All');
  }

  protected openIntake(r: DirectoryRecord): void {
    this.intake.open(r);
    this.dashboard.setNav('Worklist');
  }

  protected ageFromDob(dob: string): number {
    const birth = new Date(dob);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const hadBirthdayThisYear =
      now.getMonth() > birth.getMonth() ||
      (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate());
    if (!hadBirthdayThisYear) age--;
    return age;
  }
}
