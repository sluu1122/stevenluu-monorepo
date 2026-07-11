import { Component, inject, computed, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { Menu, MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { DashboardStore } from '../../stores/dashboard.store';
import { IntakeWizardStore } from '../../stores/intake-wizard.store';
import { AiAssistantService, createAiField } from '../../services/ai-assistant.service';
import { IntakeModalComponent } from '../intake-modal/intake-modal.component';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';
import type { Patient, PatientStatus, WorklistTab } from '../../models/patient.model';

interface KpiTile {
  label: string;
  count: number;
  dot: string;
  status: PatientStatus | 'All';
}

const CASE_SUMMARY_SYSTEM =
  'You are a clinical operations coordinator. Summarize the patient case status for care team ' +
  'handoff in exactly 2 concise sentences. Be factual and specific.';

@Component({
  selector: 'app-worklist',
  standalone: true,
  imports: [FormsModule, TableModule, ButtonModule, MenuModule, IntakeModalComponent, StatusBadgeComponent],
  templateUrl: './worklist.component.html',
  styleUrl: './worklist.component.scss',
})
export class WorklistComponent {
  protected readonly store  = inject(DashboardStore);
  protected readonly intake = inject(IntakeWizardStore);
  protected readonly ai     = inject(AiAssistantService);

  @ViewChild('rowMenu') rowMenu!: Menu;
  protected menuItems = signal<MenuItem[]>([]);

  protected readonly STATUS_OPTIONS: (PatientStatus | 'All')[] = [
    'All', 'Registered', 'Pending', 'Authorized', 'Payment Posted',
  ];

  protected readonly TABS: WorklistTab[] = ['In Progress', 'Completed'];

  protected readonly kpiTiles = computed<KpiTile[]>(() => {
    const counts = this.store.kpiCounts();
    return [
      { label: 'Registered',    count: counts.registered, dot: '#94a3b8', status: 'Registered' },
      { label: 'Pending',       count: counts.pending,    dot: '#d68a2c', status: 'Pending' },
      { label: 'Authorized',    count: counts.authorized, dot: '#2a6fdb', status: 'Authorized' },
      { label: 'Payment Posted',count: counts.payment,    dot: '#10a08a', status: 'Payment Posted' },
    ];
  });

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
      `Patient: ${p.name} (${p.id}), Age: ${p.age}, Status: ${p.status}, ` +
      `Payer: ${p.payer}, Provider: ${p.assignee !== 'Unassigned' ? p.assignee : 'unassigned'}, ` +
      `Facility: ${p.facility}. Summarize their current case status for shift handoff.`,
      { system: CASE_SUMMARY_SYSTEM },
    );
  }

  protected closeSummary(): void {
    this.summaryAi.state.set('idle');
    this.summaryAi.text.set('');
    this.summaryPatientName.set('');
  }

}
