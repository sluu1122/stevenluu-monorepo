import { Component, HostListener, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { ButtonModule } from 'primeng/button';
import { IntakeCaseStore } from '../../../stores/intake-case.store';
import { sexCode, sexLabel } from '../../../shared/sex';

type SexLabel = 'Male' | 'Female' | 'Other';

@Component({
  selector: 'app-pi-patient-details',
  standalone: true,
  imports: [ReactiveFormsModule, CdkTrapFocus, ButtonModule],
  templateUrl: './patient-details.component.html',
  styleUrl: './patient-details.component.scss',
})
export class PatientDetailsComponent {
  protected readonly store = inject(IntakeCaseStore);
  protected readonly modalOpen = signal(false);
  protected readonly saveError = signal('');
  protected readonly sexLabel = sexLabel;

  protected readonly demoForm = new FormGroup({
    name:    new FormControl(''),
    dob:     new FormControl(''),
    sex:     new FormControl<SexLabel | null>(null),
    mrn:     new FormControl(''),
    address: new FormControl(''),
    phone:   new FormControl(''),
    email:   new FormControl(''),
  });

  @HostListener('document:keydown.escape')
  onEscape(): void { if (this.modalOpen()) this.closeModal(); }

  protected openModal(): void {
    const d = this.store.demographics();
    if (!d) return;
    this.saveError.set('');
    this.demoForm.reset({
      name:    d.name,
      dob:     d.dob,
      sex:     sexLabel(d.sex),
      mrn:     d.mrn,
      address: d.address,
      phone:   d.phone,
      email:   d.email,
    });
    this.modalOpen.set(true);
  }

  protected closeModal(): void { this.modalOpen.set(false); }

  protected save(): void {
    const current = this.store.demographics();
    if (!current) return;
    const v = this.demoForm.value;
    this.saveError.set('');
    this.store.saveDemographics({
      name:    v.name ?? '',
      dob:     v.dob ?? '',
      sex:     sexCode(v.sex ?? ''),
      mrn:     v.mrn ?? '',
      address: v.address ?? '',
      phone:   v.phone ?? '',
      email:   v.email ?? '',
    }).subscribe({
      next: () => this.closeModal(),
      error: (err: Error) => this.saveError.set(err.message),
    });
  }

  protected onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement) === event.currentTarget) this.closeModal();
  }
}
