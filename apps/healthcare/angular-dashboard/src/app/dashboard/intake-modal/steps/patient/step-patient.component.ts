import { Component, inject } from '@angular/core';
import {
  AbstractControl, ReactiveFormsModule, FormBuilder,
  ValidationErrors, Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { InputMaskModule } from 'primeng/inputmask';
import { IntakeWizardStore } from '../../../../stores/intake-wizard.store';

function dobValidator(ctrl: AbstractControl): ValidationErrors | null {
  const v = ctrl.value as Date | null;
  if (!v) return null;
  if (!(v instanceof Date) || isNaN(v.getTime())) return { dobInvalid: true };
  if (v > new Date()) return { dobFuture: true };
  return null;
}

// Store keeps YYYY-MM-DD; datepicker uses Date
function parseDob(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

function formatDob(d: Date | null | undefined): string {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

const PHONE_PATTERN = /^\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/;

@Component({
  selector: 'app-intake-step-patient',
  standalone: true,
  imports: [ReactiveFormsModule, SelectModule, DatePickerModule, InputTextModule, InputMaskModule],
  templateUrl: './step-patient.component.html',
})
export class StepPatientComponent {
  protected readonly store       = inject(IntakeWizardStore);
  private readonly fb            = inject(FormBuilder);
  protected readonly today       = new Date();
  protected readonly SEX_OPTIONS = ['Male', 'Female', 'Other'];

  protected readonly form = this.fb.group({
    name:  [this.store.name(),          [Validators.required]],
    dob:   [parseDob(this.store.dob()), [Validators.required, dobValidator]],
    sex:   [this.store.sex()],
    mrn:   [this.store.mrn()],
    phone: [this.store.phone(),         [Validators.required, Validators.pattern(PHONE_PATTERN)]],
    email: [this.store.email(),         [Validators.required, Validators.email]],
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(v => {
      const stringFields = ['name', 'sex', 'mrn', 'phone', 'email'] as const;
      for (const f of stringFields) {
        this.store.setPatientField(f, v[f] ?? '');
      }
      this.store.setPatientField('dob', formatDob(v.dob));
    });
  }

  validate(): boolean {
    this.form.markAllAsTouched();
    this.form.updateValueAndValidity();
    return this.form.valid;
  }
}
