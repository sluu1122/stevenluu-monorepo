import { Component, inject } from '@angular/core';
import { IntakeCaseStore } from '../../../stores/intake-case.store';

@Component({
  selector: 'app-pi-intake-status',
  standalone: true,
  imports: [],
  templateUrl: './intake-status.component.html',
  styleUrl: './intake-status.component.scss',
})
export class IntakeStatusComponent {
  private readonly store = inject(IntakeCaseStore);
  protected readonly trackerSteps = this.store.trackerSteps;
}
