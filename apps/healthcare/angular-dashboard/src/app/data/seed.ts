import type { Patient, DirectoryRecord } from '../models/patient.model';

export const ALL_PATIENTS: Patient[] = [
  { id: 'PT-04821', name: 'Eleanor Whitfield', age: 74, sex: 'F', status: 'Authorized',     assignee: 'Dr. A. Soto',   payer: 'Medicare',      facility: 'Main Campus' },
  { id: 'PT-04822', name: 'Marcus Bell',        age: 39, sex: 'M', status: 'Pending',        assignee: 'Dr. K. Lin',    payer: 'Aetna',         facility: 'North Tower' },
  { id: 'PT-04823', name: 'Priya Raman',        age: 28, sex: 'F', status: 'Registered',     assignee: 'Unassigned',    payer: 'Cigna',         facility: 'Westside Clinic' },
  { id: 'PT-04824', name: 'Theodore Nguyen',    age: 61, sex: 'M', status: 'Authorized',     assignee: 'Dr. M. Okafor', payer: 'Blue Cross',    facility: 'Main Campus' },
  { id: 'PT-04825', name: 'Sofia Castellanos',  age: 45, sex: 'F', status: 'Registered',     assignee: 'Unassigned',    payer: 'United Health', facility: 'Riverside' },
  { id: 'PT-04826', name: 'James Holloway',     age: 52, sex: 'M', status: 'Pending',        assignee: 'Dr. K. Lin',    payer: 'Cigna',         facility: 'North Tower' },
  { id: 'PT-04827', name: 'Amara Diallo',       age: 33, sex: 'F', status: 'Payment Posted', assignee: 'Dr. A. Soto',   payer: 'Aetna',         facility: 'South Pavilion' },
  { id: 'PT-04828', name: 'Walter Kim',         age: 68, sex: 'M', status: 'Payment Posted', assignee: 'Dr. M. Okafor', payer: 'Medicare',      facility: 'Main Campus' },
  { id: 'PT-04829', name: 'Grace Abernathy',    age: 57, sex: 'F', status: 'Registered',     assignee: 'Unassigned',    payer: 'Blue Cross',    facility: 'Westside Clinic' },
  { id: 'PT-04830', name: 'Daniel R. Marsh',    age: 45, sex: 'M', status: 'Completed',      assignee: 'Dr. A. Soto',   payer: 'Aetna',         facility: 'Main Campus' },
  { id: 'PT-04815', name: 'Henry Okonkwo',      age: 36, sex: 'M', status: 'Completed',      assignee: 'Dr. K. Lin',    payer: 'United Health', facility: 'North Tower' },
  { id: 'PT-04812', name: 'Lena Petrova',       age: 41, sex: 'F', status: 'Completed',      assignee: 'Dr. M. Okafor', payer: 'Medicare',      facility: 'Riverside' },
  { id: 'PT-04809', name: 'Owen Fitzgerald',    age: 25, sex: 'M', status: 'Completed',      assignee: 'Dr. A. Soto',   payer: 'Cigna',         facility: 'South Pavilion' },
];

export const DIRECTORY: DirectoryRecord[] = [
  { mrn: 'MRN-558120', name: 'Daniel R. Marsh',    dob: '1981-03-14', sex: 'M', phone: '(415) 555-0182', payer: 'Aetna',         status: 'Active',     unit: 'Emergency',   last: '2026-06-15' },
  { mrn: 'MRN-441097', name: 'Eleanor Whitfield',  dob: '1952-09-02', sex: 'F', phone: '(415) 555-0147', payer: 'Medicare',      status: 'Admitted',   unit: 'ICU',         last: '2026-06-15' },
  { mrn: 'MRN-330218', name: 'Marcus Bell',        dob: '1987-01-22', sex: 'M', phone: '(628) 555-0193', payer: 'United Health', status: 'Active',     unit: 'Emergency',   last: '2026-06-15' },
  { mrn: 'MRN-771540', name: 'Priya Raman',        dob: '1998-07-30', sex: 'F', phone: '(415) 555-0288', payer: 'Cigna',         status: 'Active',     unit: 'Observation', last: '2026-06-15' },
  { mrn: 'MRN-208863', name: 'Theodore Nguyen',    dob: '1965-11-08', sex: 'M', phone: '(510) 555-0117', payer: 'Blue Cross',    status: 'Admitted',   unit: 'Medical',     last: '2026-06-14' },
  { mrn: 'MRN-665401', name: 'Sofia Castellanos',  dob: '1981-04-19', sex: 'F', phone: '(415) 555-0334', payer: 'Aetna',         status: 'Active',     unit: 'Emergency',   last: '2026-06-15' },
  { mrn: 'MRN-119276', name: 'James Holloway',     dob: '1974-02-11', sex: 'M', phone: '(925) 555-0451', payer: 'Cigna',         status: 'Active',     unit: 'Emergency',   last: '2026-06-15' },
  { mrn: 'MRN-503388', name: 'Amara Diallo',       dob: '1993-12-05', sex: 'F', phone: '(415) 555-0506', payer: 'United Health', status: 'Active',     unit: 'Observation', last: '2026-06-15' },
  { mrn: 'MRN-884120', name: 'Walter Kim',         dob: '1958-06-27', sex: 'M', phone: '(408) 555-0162', payer: 'Medicare',      status: 'Admitted',   unit: 'Medical',     last: '2026-06-14' },
  { mrn: 'MRN-247701', name: 'Grace Abernathy',    dob: '1969-08-16', sex: 'F', phone: '(415) 555-0719', payer: 'Blue Cross',    status: 'Active',     unit: 'Emergency',   last: '2026-06-15' },
  { mrn: 'MRN-090455', name: 'Henry Okonkwo',      dob: '1990-05-03', sex: 'M', phone: '(650) 555-0820', payer: 'Aetna',         status: 'Discharged', unit: '—',           last: '2026-06-12' },
  { mrn: 'MRN-612039', name: 'Isabel Moreno',      dob: '1948-10-21', sex: 'F', phone: '(415) 555-0911', payer: 'Medicare',      status: 'Discharged', unit: '—',           last: '2026-06-10' },
  { mrn: 'MRN-738264', name: 'Owen Fitzgerald',    dob: '2001-03-29', sex: 'M', phone: '(707) 555-0140', payer: 'Cigna',         status: 'Discharged', unit: '—',           last: '2026-06-08' },
  { mrn: 'MRN-455810', name: 'Lena Petrova',       dob: '1985-07-14', sex: 'F', phone: '(415) 555-0277', payer: 'Blue Cross',    status: 'Admitted',   unit: 'ICU',         last: '2026-06-15' },
];

// Single source of truth for the demo patient used across intake & wizard views
export const DEMO_PATIENT    = ALL_PATIENTS.find(p => p.id === 'PT-04830')!;
export const DEMO_DIR_RECORD = DIRECTORY.find(r => r.mrn === 'MRN-558120')!;
