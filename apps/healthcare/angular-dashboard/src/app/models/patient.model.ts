export type PatientStatus = 'Pending' | 'Received' | 'Accepted' | 'Scheduled' | 'Completed';
export type DirStatus = 'Active' | 'Admitted' | 'Discharged';
export type Sex = 'M' | 'F' | 'O';

export interface Patient {
  id: string;
  name: string;
  age: number;
  sex: Sex;
  status: PatientStatus;
  assignee: string;
  payer: string;
  facility: string;
}

export interface NewPatientInsuranceInput {
  payer: string;
}

export interface NewPatientInput {
  name: string;
  dob: string;
  sex: Sex;
  mrn: string;
  phone: string;
  email: string;
  payer: string;
  insurances: NewPatientInsuranceInput[];
}

export interface DirectoryRecord {
  patientId?: string;
  mrn: string;
  name: string;
  dob: string;
  sex: Sex;
  phone: string;
  payer: string;
  status: DirStatus;
  unit: string;
  last: string;
}

export type NavView = 'Worklist' | 'Patient Intake' | 'Patient Search';
export type WorklistTab = 'In Progress' | 'Completed';
export type AuthType = 'Inpatient' | 'Outpatient' | 'Telehealth';
export type InsuranceRank = 'Primary' | 'Secondary' | 'Tertiary';
