import { Component, input } from '@angular/core';
import type { PatientStatus, DirStatus } from '../../models/patient.model';

interface StatusMeta { bg: string; bd: string; tx: string; dot: string; }

const STATUS_META: Record<string, StatusMeta> = {
  'Registered':    { bg: '#f4f6f9', bd: '#e6eaf0', tx: '#64748b', dot: '#94a3b8' },
  'Pending':       { bg: '#fdf5e9', bd: '#f3e2c4', tx: '#9a6212', dot: '#d68a2c' },
  'Authorized':    { bg: '#eef3fe', bd: '#d6e2fb', tx: '#2a5fd0', dot: '#2a6fdb' },
  'Payment Posted':{ bg: '#e6f6f4', bd: '#bfe7e0', tx: '#0c7c6c', dot: '#10a08a' },
  'Completed':     { bg: '#eafaf1', bd: '#cdeedd', tx: '#0f7a4f', dot: '#1aa564' },
  'Active':        { bg: '#eef3fe', bd: '#d6e2fb', tx: '#2a5fd0', dot: '#2a6fdb' },
  'Admitted':      { bg: '#eafaf1', bd: '#cdeedd', tx: '#0f7a4f', dot: '#1aa564' },
  'Discharged':    { bg: '#f4f6f9', bd: '#e6eaf0', tx: '#64748b', dot: '#94a3b8' },
};

const FALLBACK: StatusMeta = STATUS_META['Discharged'];

@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `
    <span
      class="status-badge"
      [style.background]="meta.bg"
      [style.border]="'1px solid ' + meta.bd"
      [style.color]="meta.tx"
    >
      <span class="status-dot" [style.background]="meta.dot"></span>
      {{ status() }}
    </span>
  `,
})
export class StatusBadgeComponent {
  readonly status = input.required<PatientStatus | DirStatus>();

  protected get meta(): StatusMeta {
    return STATUS_META[this.status()] ?? FALLBACK;
  }
}
