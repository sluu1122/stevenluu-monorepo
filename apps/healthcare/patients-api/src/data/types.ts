export type Sex = 'M' | 'F' | 'O';

export interface Patient {
  id: string;
  name: string;
  age: number;
  sex: Sex;
  status: string;
  assignee: string;
  payer: string;
  facility: string;
}

export interface DirectoryRecord {
  mrn: string;
  name: string;
  dob: string;
  sex: Sex;
  phone: string;
  payer: string;
  status: string;
  unit: string;
  last: string;
}

export interface CurrentUser {
  id: string;
  name: string;
  role: string;
}

export type InsuranceRank = 'Primary' | 'Secondary' | 'Tertiary';

export interface ReferenceData {
  payers: string[];
  planTypes: string[];
  authTypes: string[];
  noteCategories: string[];
  insuranceRanks: InsuranceRank[];
}

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
  authType: string;
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
