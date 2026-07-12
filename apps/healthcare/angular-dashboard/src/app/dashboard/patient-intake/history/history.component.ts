import { Component, inject, input, output } from '@angular/core';
import { IntakeCaseStore } from '../../../stores/intake-case.store';

@Component({
  selector: 'app-pi-history',
  standalone: true,
  imports: [],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss',
})
export class HistoryComponent {
  readonly expanded = input<boolean>(false);
  readonly expand   = output<void>();
  readonly collapse = output<void>();

  private readonly store = inject(IntakeCaseStore);
  protected readonly history = this.store.history;
}
