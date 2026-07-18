import { Component, inject, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { IntakeCaseStore } from '../../stores/intake-case.store';
import { PatientDetailsComponent } from './patient-details/patient-details.component';
import { PatientInsuranceComponent } from './patient-insurance/patient-insurance.component';
import { IntakeStatusComponent } from './intake-status/intake-status.component';
import { NotesComponent } from './notes/notes.component';
import { HistoryComponent } from './history/history.component';

@Component({
  selector: 'app-patient-intake',
  standalone: true,
  imports: [ButtonModule, PatientDetailsComponent, PatientInsuranceComponent, IntakeStatusComponent, NotesComponent, HistoryComponent],
  templateUrl: './patient-intake.component.html',
  styleUrl: './patient-intake.component.scss',
  // min-height lives in the SCSS :host rule (not here) so it can be overridden
  // on mobile; an inline host style would win over the media query.
  host: { style: 'display: flex; flex-direction: column; flex: 1;' },
})
export class PatientIntakeComponent {
  protected readonly store = inject(IntakeCaseStore);
  protected readonly expandedCard = signal<'notes' | 'history' | null>(null);
  protected expand(card: 'notes' | 'history'): void { this.expandedCard.set(card); }
  protected collapse(): void { this.expandedCard.set(null); }
}
