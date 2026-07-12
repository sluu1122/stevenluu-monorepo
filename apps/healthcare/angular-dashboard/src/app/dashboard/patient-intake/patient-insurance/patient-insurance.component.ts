import { Component, HostListener, computed, signal } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { ButtonModule } from 'primeng/button';
import { DEMO_PATIENT } from '../../../data/seed';
import type { AuthType } from '../../../models/patient.model';

const AUTH_TYPES: AuthType[] = ['Inpatient', 'Outpatient', 'Telehealth'];
type InsuranceContext = 'add' | 'primary' | 'secondary';

@Component({
  selector: 'app-pi-patient-insurance',
  standalone: true,
  imports: [ReactiveFormsModule, CdkTrapFocus, ButtonModule],
  templateUrl: './patient-insurance.component.html',
  styleUrl: './patient-insurance.component.scss',
})
export class PatientInsuranceComponent {
  protected readonly patient = DEMO_PATIENT;
  protected readonly AUTH_TYPES = AUTH_TYPES;
  protected readonly modalOpen = signal(false);
  protected readonly authType = signal<AuthType>('Inpatient');
  protected readonly modalContext = signal<InsuranceContext>('add');

  protected readonly modalTitle = computed(() => {
    switch (this.modalContext()) {
      case 'add':       return 'Add Insurance';
      case 'primary':   return 'Edit Primary Insurance';
      case 'secondary': return 'Edit Secondary Insurance';
    }
  });

  protected readonly insuranceForm = new FormGroup({
    provider: new FormControl(DEMO_PATIENT.payer),
    planType: new FormControl('PPO — Preferred'),
    payerId:  new FormControl('', Validators.required),
    group:    new FormControl('GRP-44120'),
    member:   new FormControl('W8842100123'),
    authType: new FormControl<AuthType>('Inpatient'),
    effDate:  new FormControl('2026-06-01'),
    expDate:  new FormControl('2027-05-31'),
  });

  protected get payerIdInvalid(): boolean {
    const ctrl = this.insuranceForm.get('payerId')!;
    return ctrl.invalid && (ctrl.touched || ctrl.dirty);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void { if (this.modalOpen()) this.closeModal(); }

  protected openModal(context: InsuranceContext = 'add'): void {
    this.modalContext.set(context);
    const isPrimary = context !== 'secondary';
    const authVal: AuthType = 'Inpatient';
    this.authType.set(authVal);
    this.insuranceForm.reset({
      provider: isPrimary ? DEMO_PATIENT.payer : 'Medicare',
      planType: isPrimary ? 'PPO — Preferred' : 'Part B',
      payerId:  '',
      group:    isPrimary ? 'GRP-44120' : '',
      member:   'W8842100123',
      authType: authVal,
      effDate:  '2026-06-01',
      expDate:  '2027-05-31',
    });
    this.modalOpen.set(true);
  }

  protected save(): void {
    this.insuranceForm.markAllAsTouched();
    if (this.insuranceForm.invalid) return;
    this.closeModal();
  }

  protected closeModal(): void { this.modalOpen.set(false); }

  protected setAuthType(type: AuthType): void {
    this.authType.set(type);
    this.insuranceForm.patchValue({ authType: type });
  }

  protected onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement) === event.currentTarget) this.closeModal();
  }
}
