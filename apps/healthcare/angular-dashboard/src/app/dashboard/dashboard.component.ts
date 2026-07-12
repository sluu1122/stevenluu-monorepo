import { Component, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { DashboardStore } from '../stores/dashboard.store';
import { SessionStore } from '../stores/session.store';
import { IntakeCaseStore } from '../stores/intake-case.store';
import { WorklistComponent } from './worklist/worklist.component';
import { PatientIntakeComponent } from './patient-intake/patient-intake.component';
import { PatientSearchComponent } from './patient-search/patient-search.component';
import type { NavView } from '../models/patient.model';

interface NavDef { label: NavView; icon: string; }

const NAV_DEFS: NavDef[] = [
  { label: 'Worklist',       icon: 'list_alt' },
  { label: 'Patient Intake', icon: 'person_add' },
  { label: 'Patient Search', icon: 'person_search' },
];

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [ButtonModule, AvatarModule, WorklistComponent, PatientIntakeComponent, PatientSearchComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  protected readonly store = inject(DashboardStore);
  protected readonly session = inject(SessionStore);
  protected readonly intakeCase = inject(IntakeCaseStore);
  protected readonly navDefs = NAV_DEFS;

  protected isNavDisabled(label: NavView): boolean {
    return label === 'Patient Intake' && !this.intakeCase.currentPatientId();
  }
}
