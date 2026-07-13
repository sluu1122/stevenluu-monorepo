import { Component, inject, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { Menu, MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { DashboardStore } from '../../../stores/dashboard.store';
import { IntakeWizardStore } from '../../../stores/intake-wizard.store';
import { IntakeCaseStore } from '../../../stores/intake-case.store';
import { AiAssistantService, createAiField } from '../../../services/ai-assistant.service';
import { IntakeModalComponent } from '../../intake-modal/intake-modal.component';
import { StatusBadgeComponent } from '../../../shared/status-badge/status-badge.component';
import type { Patient, PatientStatus } from '../../../models/patient.model';

const CASE_SUMMARY_SYSTEM =
  'You are a clinical operations coordinator. Summarize the patient case status for care team ' +
  'handoff in exactly 2 concise sentences. Be factual and specific.';

@Component({
  selector: 'app-wl-operations-table',
  standalone: true,
  imports: [FormsModule, TableModule, ButtonModule, MenuModule, IntakeModalComponent, StatusBadgeComponent],
  templateUrl: './operations-table.component.html',
  styleUrl: './operations-table.component.scss',
})
export class OperationsTableComponent {
  protected readonly store      = inject(DashboardStore);
  protected readonly intake     = inject(IntakeWizardStore);
  protected readonly intakeCase = inject(IntakeCaseStore);
  protected readonly ai         = inject(AiAssistantService);

  @ViewChild('rowMenu') rowMenu!: Menu;
  protected menuItems = signal<MenuItem[]>([]);

  protected readonly STATUS_OPTIONS: (PatientStatus | 'All')[] = [
    'All', 'Registered', 'Pending', 'Authorized', 'Payment Posted',
  ];

  // ── Row navigation ────────────────────────────────────────────────────────
  protected openPatient(p: Patient): void {
    this.intakeCase.selectPatient(p.id);
    this.store.setNav('Patient Intake');
  }

  // ── Row context menu ─────────────────────────────────────────────────────
  protected openRowMenu(event: Event, p: Patient): void {
    this.menuItems.set([{
      label: 'AI Case Summary',
      icon: 'pi pi-sparkles',
      command: () => this.summarizeCase(p),
    }]);
    this.rowMenu.toggle(event);
  }

  // ── Case Summary ──────────────────────────────────────────────────────────
  protected readonly summaryAi          = createAiField();
  protected readonly summaryPatientName = signal('');

  protected summarizeCase(p: Patient): void {
    this.summaryPatientName.set(p.name);
    this.ai.fill(
      this.summaryAi,
      `Patient: ${p.name} (${p.id}), Age: ${p.age}${p.sex}, Status: ${p.status}, ` +
      `Payer: ${p.payer}, Provider: ${p.assignee !== 'Unassigned' ? p.assignee : 'unassigned'}, ` +
      `Facility: ${p.facility}. Summarize their current case status for shift handoff.`,
      { system: CASE_SUMMARY_SYSTEM },
    );
  }

  protected closeSummary(): void {
    this.ai.abort();
    this.summaryAi.state.set('idle');
    this.summaryAi.text.set('');
    this.summaryAi.error.set('');
    this.summaryPatientName.set('');
  }

}
