import { Component, HostListener, inject, input, output, signal } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { ButtonModule } from 'primeng/button';
import { IntakeCaseStore } from '../../../stores/intake-case.store';
import { ReferenceStore } from '../../../stores/reference.store';
import { initialsOf } from '../../../shared/initials';

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

  protected readonly store = inject(IntakeCaseStore);
  protected readonly reference = inject(ReferenceStore);
  protected readonly initialsOf = initialsOf;
  protected readonly modalOpen = signal(false);
  protected readonly saveError = signal('');

  protected readonly noteForm = new FormGroup({
    category: new FormControl(''),
    note:     new FormControl(''),
  });

  @HostListener('document:keydown.escape')
  onEscape(): void { if (this.modalOpen()) this.closeModal(); }

  protected openModal(): void {
    this.saveError.set('');
    this.noteForm.reset({ category: this.reference.noteCategories()[0] ?? '', note: '' });
    this.modalOpen.set(true);
  }

  protected closeModal(): void { this.modalOpen.set(false); }

  protected save(): void {
    const { category, note } = this.noteForm.value;
    if (!note?.trim()) return;
    this.saveError.set('');
    this.store.addNote({ category: category || 'Clinical', text: note.trim() }).subscribe({
      next: () => this.closeModal(),
      error: (err: Error) => this.saveError.set(err.message),
    });
  }

  protected onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement) === event.currentTarget) this.closeModal();
  }
}
