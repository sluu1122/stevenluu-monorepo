import { Component } from '@angular/core';
import { PatientDetailsComponent } from './patient-details/patient-details.component';
import { PatientInsuranceComponent } from './patient-insurance/patient-insurance.component';
import { IntakeStatusComponent } from './intake-status/intake-status.component';
import { NotesComponent } from './notes/notes.component';
import { HistoryComponent } from './history/history.component';

@Component({
  selector: 'app-patient-intake',
  standalone: true,
  imports: [PatientDetailsComponent, PatientInsuranceComponent, IntakeStatusComponent, NotesComponent, HistoryComponent],
  templateUrl: './patient-intake.component.html',
  styleUrl: './patient-intake.component.scss',
})
export class PatientIntakeComponent {}
