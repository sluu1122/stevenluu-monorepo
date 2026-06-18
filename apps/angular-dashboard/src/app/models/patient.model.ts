export type PatientStatus = 'Registered' | 'Pending' | 'Authorized' | 'Payment Posted' | 'Completed';
export type DirStatus = 'Active' | 'Admitted' | 'Discharged';

export interface Patient {
  id: string;
  name: string;
  age: string;
  status: PatientStatus;
  assignee: string;
  payer: string;
  facility: string;
}

export interface DirectoryRecord {
  mrn: string;
  name: string;
  dob: string;
  sex: string;
  phone: string;
  payer: string;
  status: DirStatus;
  unit: string;
  last: string;
}

export type NavView = 'Worklist' | 'Patient Intake' | 'Patient Search';
export type WorklistTab = 'In Progress' | 'Completed';
export type ModalKind = 'demographics' | 'insurance' | 'note' | undefined;
export type AuthType = 'Inpatient' | 'Outpatient' | 'Telehealth';
export type Determination = 'Approved' | 'Pending' | 'Denied';
