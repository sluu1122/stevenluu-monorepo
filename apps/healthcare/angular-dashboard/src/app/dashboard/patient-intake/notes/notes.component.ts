import { Component, computed, inject, input, output, signal } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { IntakeCaseStore } from '../../../stores/intake-case.store';
import { ReferenceStore } from '../../../stores/reference.store';
import { initialsOf } from '../../../shared/initials';
import { PiViewModalComponent } from '../../../shared/pi-view-modal/pi-view-modal.component';

@Component({
  selector: 'app-pi-notes',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonModule, PiViewModalComponent],
  templateUrl: './notes.component.html',
  styleUrl: './notes.component.scss',
})
export class NotesComponent {
  readonly expanded = input<boolean>(false);
  readonly expand   = output<void>();
  readonly collapse = output<void>();

  protected readonly store = inject(IntakeCaseStore);
  protected readonly reference = inject(ReferenceStore);
  protected readonly modalOpen = signal(false);
  protected readonly saveError = signal('');

  protected readonly notesVm = computed(() =>
    this.store.notes().map(n => ({ ...n, initials: initialsOf(n.author) }))
  );

  protected readonly noteForm = new FormGroup({
    category: new FormControl(''),
    note:     new FormControl(''),
  });

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
}
