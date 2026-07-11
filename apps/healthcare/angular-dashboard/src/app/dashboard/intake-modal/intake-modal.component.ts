import {
  Component, HostListener, ViewEncapsulation, computed, inject, viewChild,
} from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { ButtonModule } from 'primeng/button';
import { IntakeWizardStore } from '../../stores/intake-wizard.store';
import { StepPatientComponent } from './steps/patient/step-patient.component';
import { StepDiagnosisComponent } from './steps/diagnosis/step-diagnosis.component';
import { StepProcedureComponent } from './steps/procedure/step-procedure.component';
import { StepInsuranceComponent } from './steps/insurance/step-insurance.component';
import { StepReviewComponent } from './steps/review/step-review.component';

const STEPS = ['Patient', 'Diagnosis', 'Procedure', 'Insurance', 'Review'];

@Component({
  selector: 'app-intake-modal',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [
    A11yModule,
    ButtonModule,
    StepPatientComponent,
    StepDiagnosisComponent,
    StepProcedureComponent,
    StepInsuranceComponent,
    StepReviewComponent,
  ],
  templateUrl: './intake-modal.component.html',
  styleUrl: './intake-modal.component.scss',
})
export class IntakeModalComponent {
  protected readonly store = inject(IntakeWizardStore);
  protected readonly STEPS = STEPS;

  // Signal queries resolve synchronously with the current view state —
  // returns undefined when the @if condition is false, which is safe here
  // because onContinue() only reads the active step's component.
  private readonly patientStep   = viewChild(StepPatientComponent);
  private readonly diagnosisStep = viewChild(StepDiagnosisComponent);
  private readonly procedureStep = viewChild(StepProcedureComponent);
  private readonly insuranceStep = viewChild(StepInsuranceComponent);

  protected readonly stepVm = computed(() => {
    const active = this.store.activeStep();
    return STEPS.map((label, i) => {
      const n    = i + 1;
      const done = n < active;
      const cur  = n === active;
      return { n, label, done, active: cur };
    });
  });

  protected goToStep(n: number): void {
    this.store.goToStep(n);
  }

  protected onContinue(): void {
    const step = this.store.activeStep();
    let valid = true;

    if      (step === 1) valid = this.patientStep()?.validate()   ?? true;
    else if (step === 2) valid = this.diagnosisStep()?.validate() ?? true;
    else if (step === 3) valid = this.procedureStep()?.validate() ?? true;
    else if (step === 4) valid = this.insuranceStep()?.validate() ?? true;

    if (valid) this.store.nextStep();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void { this.store.close(); }
}
