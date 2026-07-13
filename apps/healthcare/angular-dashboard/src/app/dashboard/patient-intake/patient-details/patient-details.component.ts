import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { IntakeCaseStore } from '../../../stores/intake-case.store';
import { sexCode, sexLabel, SEX_LABELS, type SexLabel } from '../../../shared/sex';
import { PiViewModalComponent } from '../../../shared/pi-view-modal/pi-view-modal.component';

@Component({
  selector: 'app-pi-patient-details',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonModule, PiViewModalComponent],
  templateUrl: './patient-details.component.html',
  styleUrl: './patient-details.component.scss',
})
export class PatientDetailsComponent {
  protected readonly store = inject(IntakeCaseStore);
  protected readonly modalOpen = signal(false);
  protected readonly saveError = signal('');
  protected readonly sexLabel = sexLabel;
  protected readonly SEX_LABELS = SEX_LABELS;

  protected readonly demoForm = new FormGroup({
    name:    new FormControl('', Validators.required),
    dob:     new FormControl('', Validators.required),
    sex:     new FormControl<SexLabel | null>(null),
    mrn:     new FormControl('', Validators.required),
    address: new FormControl(''),
    phone:   new FormControl(''),
    email:   new FormControl(''),
  });

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
    this.demoForm.markAllAsTouched();
    if (this.demoForm.invalid) return;

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
}
