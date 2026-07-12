import { Component, HostListener, signal } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { ButtonModule } from 'primeng/button';
import { DEMO_DIR_RECORD } from '../../../data/seed';

@Component({
  selector: 'app-pi-patient-details',
  standalone: true,
  imports: [ReactiveFormsModule, CdkTrapFocus, ButtonModule],
  templateUrl: './patient-details.component.html',
  styleUrl: './patient-details.component.scss',
})
export class PatientDetailsComponent {
  protected readonly record = DEMO_DIR_RECORD;
  protected readonly modalOpen = signal(false);

  protected readonly demoForm = new FormGroup({
    name:    new FormControl(DEMO_DIR_RECORD.name),
    dob:     new FormControl(DEMO_DIR_RECORD.dob),
    sex:     new FormControl(DEMO_DIR_RECORD.sex === 'M' ? 'Male' : 'Female'),
    mrn:     new FormControl(DEMO_DIR_RECORD.mrn),
    address: new FormControl('1420 Pacific Heights Blvd'),
    phone:   new FormControl(DEMO_DIR_RECORD.phone),
    email:   new FormControl('daniel.marsh@example.com'),
  });

  @HostListener('document:keydown.escape')
  onEscape(): void { if (this.modalOpen()) this.closeModal(); }

  protected openModal(): void { this.modalOpen.set(true); }
  protected closeModal(): void { this.modalOpen.set(false); }
  protected onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement) === event.currentTarget) this.closeModal();
  }
}
