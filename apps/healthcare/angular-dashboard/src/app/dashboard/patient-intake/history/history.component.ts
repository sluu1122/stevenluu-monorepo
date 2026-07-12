import { Component, input, output } from '@angular/core';

interface HistoryEvent { text: string; time: string; actor: string; dot: string; }
interface HistoryGroup { date: string; events: HistoryEvent[]; }

const HISTORY: HistoryGroup[] = [
  {
    date: 'Today · Jun 15',
    events: [
      { text: 'Eligibility check initiated. Payer ID missing — action required.',  time: '09:51', actor: 'System',        dot: '#d68a2c' },
      { text: 'Primary insurance added: Aetna PPO · GRP-44120.',                   time: '09:48', actor: 'Avery Chen',    dot: '#1aa564' },
      { text: 'Patient demographics captured and verified against MPI.',            time: '09:46', actor: 'Avery Chen',    dot: '#1aa564' },
      { text: 'Intake record created. Provisional ID assigned.',                    time: '09:45', actor: 'System',        dot: '#2a6fdb' },
    ],
  },
  {
    date: 'Jun 14',
    events: [
      { text: 'Referral letter received from Dr. Okafor at Main Campus.',           time: '16:20', actor: 'Dr. M. Okafor', dot: '#2a6fdb' },
      { text: 'Patient contacted to schedule intake appointment.',                   time: '14:05', actor: 'Avery Chen',    dot: '#1aa564' },
    ],
  },
  {
    date: 'Jun 12',
    events: [
      { text: 'Patient record initiated from Emergency Department visit.',           time: '11:30', actor: 'System',        dot: '#2a6fdb' },
    ],
  },
];

@Component({
  selector: 'app-pi-history',
  standalone: true,
  imports: [],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss',
})
export class HistoryComponent {
  readonly expanded = input<boolean>(false);
  readonly expand   = output<void>();
  readonly collapse = output<void>();

  protected readonly history = HISTORY;
}
