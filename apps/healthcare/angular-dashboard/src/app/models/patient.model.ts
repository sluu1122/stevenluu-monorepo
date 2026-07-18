export type PatientStatus = 'Pending' | 'Received' | 'Accepted' | 'Scheduled' | 'Completed';
export type Sex = 'M' | 'F' | 'O';

export interface Patient {
  id: string;
  name: string;
  age: number;
  sex: Sex;
  status: PatientStatus;
  assignee: string;
  payor: string;
  facility: string;
}

export interface NewPatientInsuranceInput {
  payor: string;
}

export interface NewPatientInput {
  name: string;
  dob: string;
  sex: Sex;
  mrn: string;
  phone: string;
  email: string;
  payor: string;
  insurances: NewPatientInsuranceInput[];
}

export interface DirectoryRecord {
  patientId?: string;
  mrn: string;
  name: string;
  dob: string;
  sex: Sex;
  phone: string;
  payor: string;
  plan: string;
  unit: string;
  last: string;
}

export type NavView = 'Worklist' | 'Patient Intake' | 'Patient Search';
export type WorklistTab = 'In Progress' | 'Completed';
export type AuthType = 'Inpatient' | 'Outpatient' | 'Telehealth';
export type InsuranceRank = 'Primary' | 'Secondary' | 'Tertiary';
