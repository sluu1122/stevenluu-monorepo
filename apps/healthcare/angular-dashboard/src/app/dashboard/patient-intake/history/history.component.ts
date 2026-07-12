import { Component } from '@angular/core';

interface HistoryItem { text: string; time: string; actor: string; dot: string; last: boolean; }

const HISTORY: HistoryItem[] = [
  { text: 'Intake record created. Provisional ID assigned.',                     time: '09:45', actor: 'System',      dot: '#2a6fdb', last: false },
  { text: 'Patient demographics captured and verified against MPI.',             time: '09:46', actor: 'Avery Chen',  dot: '#1aa564', last: false },
  { text: 'Primary insurance added: Aetna PPO · GRP-44120.',                    time: '09:48', actor: 'Avery Chen',  dot: '#1aa564', last: false },
  { text: 'Eligibility check initiated. Payer ID missing — action required.',   time: '09:51', actor: 'System',      dot: '#d68a2c', last: true  },
];

@Component({
  selector: 'app-pi-history',
  standalone: true,
  imports: [],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss',
})
export class HistoryComponent {
  protected readonly history = HISTORY;
}
