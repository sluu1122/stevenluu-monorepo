import type { AuthType, InsuranceRank, Sex } from './patient.model';

export interface Demographics {
  name: string;
  dob: string;
  sex: Sex;
  mrn: string;
  phone: string;
  email: string;
  address: string;
}

export interface Insurance {
  id: string;
  rank: InsuranceRank;
  provider: string;
  planType: string;
  payerId: string;
  groupNumber: string;
  memberId: string;
  authType: AuthType;
  effectiveDate: string;
  expirationDate: string;
}

export type InsuranceInput = Omit<Insurance, 'id'>;

export interface IntakeNote {
  id: string;
  author: string;
  avatarTint: 'blue' | 'purple';
  time: string;
  category: string;
  text: string;
}

export interface NoteInput {
  category: string;
  text: string;
}

export interface IntakeDocument {
  id: string;
  name: string;
  sizeLabel: string;
  kind: 'image' | 'pdf';
}

export interface HistoryEvent {
  text: string;
  time: string;
  actor: string;
  dot: string;
}

export interface HistoryGroup {
  date: string;
  events: HistoryEvent[];
}

export interface TrackerStep {
  n: number;
  label: string;
  sub: string;
  done: boolean;
  active: boolean;
}

export interface IntakeCase {
  patientId: string;
  demographics: Demographics;
  insurances: Insurance[];
  notes: IntakeNote[];
  documents: IntakeDocument[];
  history: HistoryGroup[];
  trackerSteps: TrackerStep[];
}
