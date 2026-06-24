import { Component, inject } from '@angular/core';
import {
  AbstractControl, ReactiveFormsModule, FormBuilder,
  ValidationErrors, Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IntakeWizardStore } from '../../../../stores/intake-wizard.store';

function dobValidator(ctrl: AbstractControl): ValidationErrors | null {
  const v = (ctrl.value as string | null) ?? '';
  if (!v) return null; // required validator handles empty
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return { dobFormat: true };
  const d = new Date(v);
  if (isNaN(d.getTime())) return { dobInvalid: true };
  if (d > new Date()) return { dobFuture: true };
  return null;
}

const PHONE_PATTERN = /^\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/;

@Component({
  selector: 'app-intake-step-patient',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './step-patient.component.html',
})
export class StepPatientComponent {
  protected readonly store = inject(IntakeWizardStore);
  private readonly fb      = inject(FormBuilder);

  protected readonly form = this.fb.group({
    name:  [this.store.name(),  [Validators.required]],
    dob:   [this.store.dob(),   [Validators.required, dobValidator]],
    sex:   [this.store.sex()],
    mrn:   [this.store.mrn()],
    phone: [this.store.phone(), [Validators.required, Validators.pattern(PHONE_PATTERN)]],
    email: [this.store.email(), [Validators.required, Validators.email]],
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(v => {
      const fields = ['name', 'dob', 'sex', 'mrn', 'phone', 'email'] as const;
      for (const f of fields) {
        this.store.setPatientField(f, v[f] ?? '');
      }
    });
  }

  validate(): boolean {
    this.form.markAllAsTouched();
    this.form.updateValueAndValidity();
    return this.form.valid;
  }
}
