import { Component, HostListener, input, output } from '@angular/core';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-pi-view-modal',
  standalone: true,
  imports: [CdkTrapFocus, ButtonModule],
  templateUrl: './pi-view-modal.component.html',
})
export class PiViewModalComponent {
  readonly title = input.required<string>();
  readonly closeModal = output<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void { this.closeModal.emit(); }
}
