import type { Demographics, InsuranceInput, IntakeCase } from './types.js';
import { CURRENT_USER } from './current-user.js';

let insSeq = 3;
let noteSeq = 3;

const intakeCase: IntakeCase = {
  patientId: 'PT-04830',
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
      payerId: '', groupNumber: 'GRP-44120', memberId: 'W8842100123',
      authType: 'Inpatient', effectiveDate: '2026-06-01', expirationDate: '2027-05-31',
    },
    {
      id: 'ins-2', rank: 'Secondary', provider: 'Medicare', planType: 'Part B',
      payerId: '', groupNumber: '', memberId: 'W8842100123',
      authType: 'Inpatient', effectiveDate: '2026-06-01', expirationDate: '2027-05-31',
    },
  ],
  notes: [
    { id: 'note-1', author: 'Avery Chen',    avatarTint: 'blue',   time: '09:51', category: 'Insurance', text: 'Patient reports prior authorization on file with previous provider. Awaiting payer ID from referring office to confirm.' },
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
        { text: 'Eligibility check initiated. Payer ID missing — action required.', time: '09:51', actor: 'System',        dot: '#d68a2c' },
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
    { n: 1, label: 'Registered',     sub: 'Identity verified',    done: true,  active: false },
    { n: 2, label: 'Pending',        sub: 'Eligibility pending',  done: false, active: true  },
    { n: 3, label: 'Authorized',     sub: 'Awaiting payer',       done: false, active: false },
    { n: 4, label: 'Payment Posted', sub: 'Financial clearance',  done: false, active: false },
    { n: 5, label: 'Completed',      sub: 'Case closed',          done: false, active: false },
  ],
};

function nowTime(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
}

export function getIntakeCase(): IntakeCase {
  return intakeCase;
}

export function updateDemographics(input: Demographics): IntakeCase {
  Object.assign(intakeCase.demographics, input);
  return intakeCase;
}

export function addInsurance(input: InsuranceInput): IntakeCase {
  intakeCase.insurances.push({
    ...input,
    id: `ins-${insSeq++}`,
  });
  return intakeCase;
}

export function updateInsurance(id: string, input: InsuranceInput): IntakeCase | undefined {
  const existing = intakeCase.insurances.find(i => i.id === id);
  if (!existing) return undefined;
  Object.assign(existing, input);
  return intakeCase;
}

export function deleteInsurance(id: string): IntakeCase | undefined {
  const idx = intakeCase.insurances.findIndex(i => i.id === id);
  if (idx === -1) return undefined;
  intakeCase.insurances.splice(idx, 1);
  return intakeCase;
}

export function addNote(input: { category: string; text: string }): IntakeCase {
  intakeCase.notes.unshift({
    id: `note-${noteSeq++}`,
    author: CURRENT_USER.name,
    avatarTint: 'blue',
    time: nowTime(),
    category: input.category,
    text: input.text,
  });
  return intakeCase;
}
