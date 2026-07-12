import { Component } from '@angular/core';
import { StatusTilesComponent } from './status-tiles/status-tiles.component';
import { OperationsTableComponent } from './operations-table/operations-table.component';

@Component({
  selector: 'app-worklist',
  standalone: true,
  imports: [StatusTilesComponent, OperationsTableComponent],
  templateUrl: './worklist.component.html',
})
export class WorklistComponent {}
