import { Component } from '@angular/core';

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

@Component({
  selector: 'app-pi-intake-status',
  standalone: true,
  imports: [],
  templateUrl: './intake-status.component.html',
  styleUrl: './intake-status.component.scss',
})
export class IntakeStatusComponent {
  protected readonly trackerSteps = TRACKER_STEPS;
}
