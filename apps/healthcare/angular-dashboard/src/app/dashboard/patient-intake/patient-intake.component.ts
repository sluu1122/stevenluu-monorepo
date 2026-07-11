import { Component, computed, signal, HostListener } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { A11yModule } from '@angular/cdk/a11y';
import { ButtonModule } from 'primeng/button';
import { DEMO_PATIENT, DEMO_DIR_RECORD } from '../../data/seed';
import type { AuthType } from '../../models/patient.model';

const AUTH_TYPES: AuthType[] = ['Inpatient', 'Outpatient', 'Telehealth'];

interface TrackerStep {
  n: number;
  label: string;
  sub: string;
  done: boolean;
  active: boolean;
}

const TRACKER_STEPS: TrackerStep[] = [
  { n: 1, label: 'Registered',     sub: 'Identity verified',    done: true,  active: false },
  { n: 2, label: 'Pending',        sub: 'Eligibility pending',  done: false, active: true  },
  { n: 3, label: 'Authorized',     sub: 'Awaiting payer',       done: false, active: false },
  { n: 4, label: 'Payment Posted', sub: 'Financial clearance',  done: false, active: false },
  { n: 5, label: 'Completed',      sub: 'Case closed',          done: false, active: false },
];

interface HistoryItem { text: string; time: string; actor: string; dot: string; last: boolean; }
const HISTORY: HistoryItem[] = [
  { text: 'Intake record created. Provisional ID assigned.',                     time: '09:45', actor: 'System',      dot: '#2a6fdb', last: false },
  { text: 'Patient demographics captured and verified against MPI.',             time: '09:46', actor: 'Avery Chen',  dot: '#1aa564', last: false },
  { text: 'Primary insurance added: Aetna PPO · GRP-44120.',                    time: '09:48', actor: 'Avery Chen',  dot: '#1aa564', last: false },
  { text: 'Eligibility check initiated. Payer ID missing — action required.',   time: '09:51', actor: 'System',      dot: '#d68a2c', last: true  },
];

@Component({
  selector: 'app-patient-intake',
  standalone: true,
  imports: [ReactiveFormsModule, A11yModule, ButtonModule],
  templateUrl: './patient-intake.component.html',
  styleUrl: './patient-intake.component.scss',
})
export class PatientIntakeComponent {
  protected readonly AUTH_TYPES   = AUTH_TYPES;
  protected readonly trackerSteps = TRACKER_STEPS;
  protected readonly history      = HISTORY;
  protected readonly patient      = DEMO_PATIENT;
  protected readonly record       = DEMO_DIR_RECORD;

  // ── Inline edit modal state ───────────────────────────────────────────────
  protected readonly modalKind = signal<'demographics' | 'insurance' | 'note' | null>(null);
  protected readonly authType  = signal<AuthType>('Inpatient');

  protected readonly modalTitle = computed(() => {
    switch (this.modalKind()) {
      case 'demographics': return 'Edit Demographics';
      case 'insurance':    return 'Edit Insurance';
      case 'note':         return 'Add Note';
      default:             return '';
    }
  });

  // ── Forms ─────────────────────────────────────────────────────────────────
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

  protected readonly demoForm = new FormGroup({
    name:    new FormControl(DEMO_DIR_RECORD.name),
    dob:     new FormControl(DEMO_DIR_RECORD.dob),
    sex:     new FormControl(DEMO_DIR_RECORD.sex === 'M' ? 'Male' : 'Female'),
    mrn:     new FormControl(DEMO_DIR_RECORD.mrn),
    address: new FormControl('1420 Pacific Heights Blvd'),
    phone:   new FormControl(DEMO_DIR_RECORD.phone),
    email:   new FormControl('daniel.marsh@example.com'),
  });

  protected readonly noteForm = new FormGroup({
    category: new FormControl('Clinical'),
    note:     new FormControl(''),
  });

  protected get payerIdInvalid(): boolean {
    const ctrl = this.insuranceForm.get('payerId');
    return !!ctrl && ctrl.invalid && (ctrl.touched || ctrl.dirty);
  }

  // ── Modal handlers ────────────────────────────────────────────────────────
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.modalKind()) this.closeModal();
  }

  protected openModal(kind: 'demographics' | 'insurance' | 'note'): void {
    this.modalKind.set(kind);
  }

  protected closeModal(): void { this.modalKind.set(null); }

  protected setAuthType(type: AuthType): void { this.authType.set(type); }

  protected onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement) === event.currentTarget) this.closeModal();
  }
}
