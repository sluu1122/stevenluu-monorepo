import type { Patient, Sex } from './types.js';

export const ALL_PATIENTS: Patient[] = [
  { id: 'PT-03184', name: 'Eleanor Whitfield', age: 74, sex: 'F', status: 'Authorized',     assignee: 'Dr. A. Soto',   payer: 'Medicare',      facility: 'Main Campus' },
  { id: 'PT-05622', name: 'Marcus Bell',        age: 39, sex: 'M', status: 'Pending',        assignee: 'Dr. K. Lin',    payer: 'Aetna',         facility: 'North Tower' },
  { id: 'PT-02947', name: 'Priya Raman',        age: 28, sex: 'O', status: 'Registered',     assignee: 'Unassigned',    payer: 'Cigna',         facility: 'Westside Clinic' },
  { id: 'PT-07103', name: 'Theodore Nguyen',    age: 61, sex: 'M', status: 'Authorized',     assignee: 'Dr. M. Okafor', payer: 'Blue Cross',    facility: 'Main Campus' },
  { id: 'PT-04458', name: 'Sofia Castellanos',  age: 45, sex: 'F', status: 'Registered',     assignee: 'Unassigned',    payer: 'United Health', facility: 'Riverside' },
  { id: 'PT-06215', name: 'James Holloway',     age: 52, sex: 'O', status: 'Pending',        assignee: 'Dr. K. Lin',    payer: 'Cigna',         facility: 'North Tower' },
  { id: 'PT-01839', name: 'Amara Diallo',       age: 33, sex: 'F', status: 'Payment Posted', assignee: 'Dr. A. Soto',   payer: 'Aetna',         facility: 'South Pavilion' },
  { id: 'PT-08340', name: 'Walter Kim',         age: 68, sex: 'M', status: 'Payment Posted', assignee: 'Dr. M. Okafor', payer: 'Medicare',      facility: 'Main Campus' },
  { id: 'PT-03771', name: 'Grace Abernathy',    age: 57, sex: 'F', status: 'Registered',     assignee: 'Unassigned',    payer: 'Blue Cross',    facility: 'Westside Clinic' },
  { id: 'PT-04830', name: 'Daniel R. Marsh',    age: 45, sex: 'M', status: 'Completed',      assignee: 'Dr. A. Soto',   payer: 'Aetna',         facility: 'Main Campus' },
  { id: 'PT-05967', name: 'Henry Okonkwo',      age: 36, sex: 'M', status: 'Completed',      assignee: 'Dr. K. Lin',    payer: 'United Health', facility: 'North Tower' },
  { id: 'PT-02508', name: 'Lena Petrova',       age: 41, sex: 'F', status: 'Completed',      assignee: 'Dr. M. Okafor', payer: 'Medicare',      facility: 'Riverside' },
  { id: 'PT-06694', name: 'Owen Fitzgerald',    age: 25, sex: 'M', status: 'Completed',      assignee: 'Dr. A. Soto',   payer: 'Cigna',         facility: 'South Pavilion' },
];

export interface NewPatientInput {
  name: string;
  dob: string;
  sex: Sex;
  payer: string;
}

let patientSeq = 9001;

function ageFromDob(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const hadBirthdayThisYear =
    now.getMonth() > birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate());
  if (!hadBirthdayThisYear) age--;
  return age;
}

export function addPatient(input: NewPatientInput): Patient {
  const patient: Patient = {
    id: `PT-${String(patientSeq++).padStart(5, '0')}`,
    name: input.name,
    age: ageFromDob(input.dob),
    sex: input.sex,
    status: 'Registered',
    assignee: 'Unassigned',
    payer: input.payer,
    facility: 'Main Campus',
  };
  ALL_PATIENTS.push(patient);
  return patient;
}

export function assignPatient(id: string, assignee: string): Patient | undefined {
  const patient = ALL_PATIENTS.find(p => p.id === id);
  if (!patient) return undefined;
  patient.assignee = assignee;
  return patient;
}
