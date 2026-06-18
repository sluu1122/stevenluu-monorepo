import { Component, inject } from '@angular/core';
import { BoardStore } from '../stores/board.store';
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
  selector: 'app-board',
  standalone: true,
  imports: [WorklistComponent, PatientIntakeComponent, PatientSearchComponent],
  templateUrl: './board.component.html',
  styleUrl: './board.component.scss',
})
export class BoardComponent {
  protected readonly store = inject(BoardStore);
  protected readonly navDefs = NAV_DEFS;
}
