import { Component, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DashboardStore } from '../../stores/dashboard.store';
import { IntakeWizardStore } from '../../stores/intake-wizard.store';
import { StatusTilesComponent } from './status-tiles/status-tiles.component';
import { OperationsTableComponent } from './operations-table/operations-table.component';
import type { WorklistTab } from '../../models/patient.model';

@Component({
  selector: 'app-worklist',
  standalone: true,
  imports: [ButtonModule, StatusTilesComponent, OperationsTableComponent],
  templateUrl: './worklist.component.html',
  styleUrl: './worklist.component.scss',
})
export class WorklistComponent {
  protected readonly store  = inject(DashboardStore);
  protected readonly intake = inject(IntakeWizardStore);

  protected readonly TABS: WorklistTab[] = ['In Progress', 'Completed'];
}
