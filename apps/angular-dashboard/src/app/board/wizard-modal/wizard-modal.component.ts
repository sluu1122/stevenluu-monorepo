import { Component, inject, HostListener } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { A11yModule } from '@angular/cdk/a11y';
import { IntakeWizardStore } from '../../stores/intake-wizard.store';
import { DEMO_DIR_RECORD } from '../../data/seed';
import type { AuthType } from '../../models/patient.model';

const AUTH_TYPES: AuthType[] = ['Inpatient', 'Outpatient', 'Telehealth'];

@Component({
  selector: 'app-wizard-modal',
  standalone: true,
  imports: [ReactiveFormsModule, A11yModule],
  templateUrl: './wizard-modal.component.html',
  styleUrl: './wizard-modal.component.scss',
})
export class WizardModalComponent {
  protected readonly store = inject(IntakeWizardStore);
  protected readonly AUTH_TYPES = AUTH_TYPES;
  protected readonly STEPS = ['Registration', 'Eligibility Verification', 'Prior Authorization'];
  protected readonly demo = DEMO_DIR_RECORD;

  protected readonly eligibilityForm = new FormGroup({
    provider: new FormControl('Aetna'),
    planType: new FormControl('PPO — Preferred'),
    payerId:  new FormControl('', Validators.required),
    group:    new FormControl('GRP-44120'),
    member:   new FormControl('W8842100123'),
  });

  protected readonly authForm = new FormGroup({
    authNumber: new FormControl('AUTH-20461'),
    cptCode:    new FormControl('99285'),
    service:    new FormControl('Emergency Department Visit — Level 5'),
    units:      new FormControl('1'),
    validThru:  new FormControl('2026-07-15'),
  });

  protected get payerIdInvalid(): boolean {
    const ctrl = this.eligibilityForm.get('payerId');
    return !!ctrl && ctrl.invalid && (ctrl.touched || ctrl.dirty);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void { this.store.closeWizard(); }

  protected onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement) === event.currentTarget) {
      this.store.closeWizard();
    }
  }

  protected onNext(): void {
    if (this.store.activeStep() === 3) {
      this.store.closeWizard();
    } else {
      this.store.nextStep();
    }
  }
}
