import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { IntakeCaseStore } from '../../../stores/intake-case.store';
import { ReferenceStore } from '../../../stores/reference.store';
import type { Insurance, InsuranceInput } from '../../../models/intake.model';
import type { AuthType, InsuranceRank } from '../../../models/patient.model';
import { PiViewModalComponent } from '../../../shared/pi-view-modal/pi-view-modal.component';

@Component({
  selector: 'app-pi-patient-insurance',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonModule, PiViewModalComponent],
  templateUrl: './patient-insurance.component.html',
  styleUrl: './patient-insurance.component.scss',
})
export class PatientInsuranceComponent {
  protected readonly store = inject(IntakeCaseStore);
  protected readonly reference = inject(ReferenceStore);

  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<Insurance | null>(null);
  protected readonly saveError = signal('');

  protected readonly insuranceForm = new FormGroup({
    provider: new FormControl(''),
    planType: new FormControl(''),
    payorId:  new FormControl('', Validators.required),
    group:    new FormControl(''),
    member:   new FormControl(''),
    authType: new FormControl<AuthType>('Inpatient'),
    rank:     new FormControl<InsuranceRank>('Primary'),
    effDate:  new FormControl(''),
    expDate:  new FormControl(''),
  });

  protected readonly rank = toSignal(this.insuranceForm.controls.rank.valueChanges, {
    initialValue: this.insuranceForm.controls.rank.value,
  });

  protected readonly authType = toSignal(this.insuranceForm.controls.authType.valueChanges, {
    initialValue: this.insuranceForm.controls.authType.value,
  });

  protected readonly modalTitle = computed(() =>
    `${this.editing() ? 'Edit' : 'Add'} ${this.rank()} Insurance`
  );

  protected get payorIdInvalid(): boolean {
    const ctrl = this.insuranceForm.get('payorId')!;
    return ctrl.invalid && (ctrl.touched || ctrl.dirty);
  }

  protected openModal(ins: Insurance | null = null): void {
    this.editing.set(ins);
    this.saveError.set('');
    const authVal: AuthType = ins?.authType ?? 'Inpatient';
    const rankVal: InsuranceRank = ins?.rank ?? this.reference.insuranceRanks()[0] ?? 'Primary';

    this.insuranceForm.reset({
      provider: ins?.provider ?? this.reference.payors()[0] ?? '',
      planType: ins?.planType ?? this.reference.planTypes()[0] ?? '',
      payorId:  ins?.payorId ?? '',
      group:    ins?.groupNumber ?? '',
      member:   ins?.memberId ?? '',
      authType: authVal,
      rank:     rankVal,
      effDate:  ins?.effectiveDate ?? '',
      expDate:  ins?.expirationDate ?? '',
    });
    this.modalOpen.set(true);
  }

  protected save(): void {
    this.insuranceForm.markAllAsTouched();
    if (this.insuranceForm.invalid) return;

    const v = this.insuranceForm.value;
    const input: InsuranceInput = {
      rank:           v.rank ?? 'Primary',
      provider:       v.provider ?? '',
      planType:       v.planType ?? '',
      payorId:        v.payorId ?? '',
      groupNumber:    v.group ?? '',
      memberId:       v.member ?? '',
      authType:       v.authType ?? 'Inpatient',
      effectiveDate:  v.effDate ?? '',
      expirationDate: v.expDate ?? '',
    };

    this.saveError.set('');
    const ins = this.editing();
    const request = ins ? this.store.updateInsurance(ins.id, input) : this.store.addInsurance(input);
    request.subscribe({
      next: () => this.closeModal(),
      error: (err: Error) => this.saveError.set(err.message),
    });
  }

  protected closeModal(): void { this.modalOpen.set(false); }

  protected delete(): void {
    const ins = this.editing();
    if (!ins) return;
    this.saveError.set('');
    this.store.deleteInsurance(ins.id).subscribe({
      next: () => this.closeModal(),
      error: (err: Error) => this.saveError.set(err.message),
    });
  }

  protected setAuthType(type: AuthType): void {
    this.insuranceForm.patchValue({ authType: type });
  }

  protected setRank(r: InsuranceRank): void {
    this.insuranceForm.patchValue({ rank: r });
  }
}
