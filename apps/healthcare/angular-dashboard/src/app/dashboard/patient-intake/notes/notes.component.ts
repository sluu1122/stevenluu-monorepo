import { Component, HostListener, input, output, signal } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-pi-notes',
  standalone: true,
  imports: [ReactiveFormsModule, CdkTrapFocus, ButtonModule],
  templateUrl: './notes.component.html',
  styleUrl: './notes.component.scss',
})
export class NotesComponent {
  readonly expanded = input<boolean>(false);
  readonly expand   = output<void>();
  readonly collapse = output<void>();

  protected readonly modalOpen = signal(false);

  protected readonly noteForm = new FormGroup({
    category: new FormControl('Clinical'),
    note:     new FormControl(''),
  });

  @HostListener('document:keydown.escape')
  onEscape(): void { if (this.modalOpen()) this.closeModal(); }

  protected openModal(): void { this.modalOpen.set(true); }
  protected closeModal(): void { this.modalOpen.set(false); }
  protected onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement) === event.currentTarget) this.closeModal();
  }
}
