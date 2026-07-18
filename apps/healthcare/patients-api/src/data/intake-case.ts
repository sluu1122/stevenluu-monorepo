import type { Demographics, HistoryEvent, HistoryGroup, InsuranceInput, IntakeCase, IntakeNote, Patient, TrackerStep } from './types.js';
import { CURRENT_USER } from './current-user.js';
import { ALL_PATIENTS } from './patients.js';
import { DIRECTORY } from './directory.js';

let insSeq = 3;
let noteSeq = 3;

const DANIEL_ID = 'PT-04830';

const DANIEL_CASE: IntakeCase = {
  patientId: DANIEL_ID,
  demographics: {
    name: 'Daniel R. Marsh',
    dob: '1981-03-14',
    sex: 'M',
    mrn: 'MRN-558120',
    phone: '(415) 555-0182',
    email: 'daniel.marsh@example.com',
    address: '1420 Pacific Heights Blvd, San Francisco, CA 94109',
  },
  insurances: [
    {
      id: 'ins-1', rank: 'Primary', provider: 'Aetna', planType: 'PPO — Preferred',
      payorId: '', groupNumber: 'GRP-44120', memberId: 'W8842100123',
      authType: 'Inpatient', effectiveDate: '2026-06-01', expirationDate: '2027-05-31',
    },
    {
      id: 'ins-2', rank: 'Secondary', provider: 'Medicare', planType: 'Part B',
      payorId: '', groupNumber: '', memberId: 'W8842100123',
      authType: 'Inpatient', effectiveDate: '2026-06-01', expirationDate: '2027-05-31',
    },
  ],
  notes: [
    { id: 'note-1', author: 'Avery Chen',    avatarTint: 'blue',   time: '09:51', category: 'Insurance', text: 'Patient reports prior authorization on file with previous provider. Awaiting payor ID from referring office to confirm.' },
    { id: 'note-2', author: 'Dr. M. Okafor', avatarTint: 'purple', time: '09:46', category: 'Clinical',  text: 'No acute distress on initial assessment. Hold for insurance clearance before triage routing.' },
  ],
  documents: [
    { id: 'doc-1', name: 'Insurance_Card_Front.jpg', sizeLabel: '1.2 MB', kind: 'image' },
    { id: 'doc-2', name: 'Referral_Letter.pdf',      sizeLabel: '84 KB',  kind: 'pdf' },
  ],
  history: [
    {
      date: 'Today · Jun 15',
      events: [
        { text: 'Eligibility check initiated. Payor ID missing — action required.', time: '09:51', actor: 'System',        dot: '#d68a2c' },
        { text: 'Primary insurance added: Aetna PPO · GRP-44120.',                  time: '09:48', actor: 'Avery Chen',    dot: '#1aa564' },
        { text: 'Patient demographics captured and verified against MPI.',           time: '09:46', actor: 'Avery Chen',    dot: '#1aa564' },
        { text: 'Intake record created. Provisional ID assigned.',                   time: '09:45', actor: 'System',        dot: '#2a6fdb' },
      ],
    },
    {
      date: 'Jun 14',
      events: [
        { text: 'Referral letter received from Dr. Okafor at Main Campus.',          time: '16:20', actor: 'Dr. M. Okafor', dot: '#2a6fdb' },
        { text: 'Patient contacted to schedule intake appointment.',                  time: '14:05', actor: 'Avery Chen',    dot: '#1aa564' },
      ],
    },
    {
      date: 'Jun 12',
      events: [
        { text: 'Patient record initiated from Emergency Department visit.',          time: '11:30', actor: 'System',        dot: '#2a6fdb' },
      ],
    },
  ],
  trackerSteps: [
    { n: 1, label: 'Pending',    sub: 'Identity verified',    done: true,  active: false },
    { n: 2, label: 'Received',   sub: 'Eligibility pending',  done: false, active: true  },
    { n: 3, label: 'Accepted',   sub: 'Awaiting payor',       done: false, active: false },
    { n: 4, label: 'Scheduled',  sub: 'Financial clearance',  done: false, active: false },
    { n: 5, label: 'Completed',  sub: 'Case closed',          done: false, active: false },
  ],
};

const STEP_DEFS = [
  { n: 1, label: 'Pending',    sub: 'Identity verified' },
  { n: 2, label: 'Received',   sub: 'Eligibility pending' },
  { n: 3, label: 'Accepted',   sub: 'Awaiting payor' },
  { n: 4, label: 'Scheduled',  sub: 'Financial clearance' },
  { n: 5, label: 'Completed',  sub: 'Case closed' },
];

function trackerFor(status: string): TrackerStep[] {
  const currentIndex = STEP_DEFS.findIndex(s => s.label === status) + 1 || 1;
  return STEP_DEFS.map(s => ({
    ...s,
    done:   s.n < currentIndex || (s.n === currentIndex && currentIndex === 5),
    active: s.n === currentIndex && currentIndex !== 5,
  }));
}

const STATUS_NOTE: Record<string, (p: Patient) => string> = {
  Pending:   (p) => `Patient registered and identity verified against MPI. Awaiting eligibility check with ${p.payor}.`,
  Received:  (p) => `Eligibility check initiated with ${p.payor}. Payor ID confirmation pending before authorization can proceed.`,
  Accepted:  (p) => `Prior authorization confirmed with ${p.payor}. Case cleared for scheduling.`,
  Scheduled: (p) => `Payment posted and reconciled with ${p.payor}. Financial clearance complete.`,
  Completed: () => 'Case closed. All documentation finalized and archived.',
};

const STATUS_HISTORY: Record<string, (p: Patient) => string> = {
  Pending:   (p) => `Intake record created for ${p.name}. Identity verified against MPI.`,
  Received:  (p) => `Eligibility check initiated with ${p.payor}.`,
  Accepted:  (p) => `Prior authorization confirmed with ${p.payor}. Case cleared for scheduling.`,
  Scheduled: (p) => `Payment posted and reconciled with ${p.payor}.`,
  Completed: () => 'Case closed and archived. All documentation finalized.',
};

function notesFor(p: Patient): IntakeNote[] {
  const author = p.assignee !== 'Unassigned' ? p.assignee : 'Avery Chen';
  const tint: 'blue' | 'purple' = author.startsWith('Dr.') ? 'purple' : 'blue';
  const statusNote = STATUS_NOTE[p.status]?.(p) ?? `Intake review in progress for ${p.name}.`;

  const notes: IntakeNote[] = [
    { id: 'note-1', author, avatarTint: tint, time: '09:46', category: 'Clinical', text: statusNote },
  ];

  if (p.status !== 'Pending') {
    notes.unshift({
      id: 'note-2',
      author: 'Avery Chen',
      avatarTint: 'blue',
      time: '10:05',
      category: 'Insurance',
      text: `Coverage verified with ${p.payor}. No outstanding documentation required at this time.`,
    });
  }

  return notes;
}

function historyFor(p: Patient): HistoryGroup[] {
  const currentIndex = STEP_DEFS.findIndex(s => s.label === p.status) + 1 || 1;
  const times = ['09:15', '09:32', '09:48', '10:05', '10:20'];
  const events: HistoryEvent[] = [];

  for (let i = 0; i < currentIndex; i++) {
    const step = STEP_DEFS[i];
    events.push({
      text: STATUS_HISTORY[step.label]?.(p) ?? `${step.label} step reached.`,
      time: times[i],
      actor: i === 0 ? 'System' : (p.assignee !== 'Unassigned' ? p.assignee : 'Avery Chen'),
      dot: i === 0 ? '#2a6fdb' : '#1aa564',
    });
  }

  events.reverse();
  return [{ date: 'Today · Jun 15', events }];
}

function generateCase(p: Patient): IntakeCase {
  const suffix = p.id.replace('PT-', '');
  const nameParts = p.name.trim().split(/\s+/);
  const first = nameParts[0].toLowerCase().replace(/[^a-z]/g, '');
  const last  = nameParts[nameParts.length - 1].toLowerCase().replace(/[^a-z]/g, '');
  const birthYear = new Date().getFullYear() - p.age;

  return {
    patientId: p.id,
    demographics: {
      name: p.name,
      dob: `${birthYear}-01-15`,
      sex: p.sex,
      mrn: `MRN-${suffix}`,
      phone: `(415) 555-${suffix.slice(-4)}`,
      email: `${first}.${last}@example.com`,
      address: `${1000 + Number(suffix)} Market St, San Francisco, CA 94103`,
    },
    insurances: [
      {
        id: 'ins-1', rank: 'Primary', provider: p.payor, planType: 'PPO — Preferred',
        payorId: '', groupNumber: `GRP-${suffix}`, memberId: `MEM-${suffix}`,
        authType: 'Inpatient', effectiveDate: '2026-06-01', expirationDate: '2027-05-31',
      },
    ],
    notes: notesFor(p),
    documents: [],
    history: historyFor(p),
    trackerSteps: trackerFor(p.status),
  };
}

const intakeCases = new Map<string, IntakeCase>(
  ALL_PATIENTS.map(p => [p.id, p.id === DANIEL_ID ? DANIEL_CASE : generateCase(p)])
);

function nowTime(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
}

export function getIntakeCase(patientId: string): IntakeCase | undefined {
  return intakeCases.get(patientId);
}

export function updateDemographics(patientId: string, input: Demographics): IntakeCase | undefined {
  const c = intakeCases.get(patientId);
  if (!c) return undefined;
  Object.assign(c.demographics, input);

  const patient = ALL_PATIENTS.find(p => p.id === patientId);
  if (patient) {
    patient.name = input.name;
    patient.sex = input.sex;
  }

  const directoryRecord = DIRECTORY.find(d => d.patientId === patientId);
  if (directoryRecord) {
    directoryRecord.name  = input.name;
    directoryRecord.dob   = input.dob;
    directoryRecord.sex   = input.sex;
    directoryRecord.phone = input.phone;
  }

  return c;
}

export interface NewCaseDetails {
  mrn: string;
  phone: string;
  email: string;
  insurances: InsuranceInput[];
}

export function addCaseForPatient(p: Patient, details: NewCaseDetails): IntakeCase {
  const generated = generateCase(p);
  const c: IntakeCase = {
    ...generated,
    demographics: {
      ...generated.demographics,
      mrn:   details.mrn   || generated.demographics.mrn,
      phone: details.phone || generated.demographics.phone,
      email: details.email || generated.demographics.email,
    },
    insurances: details.insurances.length
      ? details.insurances.map(ins => ({ ...ins, id: `ins-${insSeq++}` }))
      : generated.insurances,
  };
  intakeCases.set(p.id, c);
  return c;
}

export function addInsurance(patientId: string, input: InsuranceInput): IntakeCase | undefined {
  const c = intakeCases.get(patientId);
  if (!c) return undefined;
  c.insurances.push({ ...input, id: `ins-${insSeq++}` });
  return c;
}

export function updateInsurance(patientId: string, id: string, input: InsuranceInput): IntakeCase | undefined {
  const c = intakeCases.get(patientId);
  if (!c) return undefined;
  const existing = c.insurances.find(i => i.id === id);
  if (!existing) return undefined;
  Object.assign(existing, input);
  return c;
}

export function deleteInsurance(patientId: string, id: string): IntakeCase | undefined {
  const c = intakeCases.get(patientId);
  if (!c) return undefined;
  const idx = c.insurances.findIndex(i => i.id === id);
  if (idx === -1) return undefined;
  c.insurances.splice(idx, 1);
  return c;
}

export function addNote(patientId: string, input: { category: string; text: string }): IntakeCase | undefined {
  const c = intakeCases.get(patientId);
  if (!c) return undefined;
  c.notes.unshift({
    id: `note-${noteSeq++}`,
    author: CURRENT_USER.name,
    avatarTint: 'blue',
    time: nowTime(),
    category: input.category,
    text: input.text,
  });
  return c;
}
