interface Patient {
  id: string;
  name: string;
  age: string;
  status: string;
  assignee: string;
  payer: string;
  facility: string;
}

export const ALL_PATIENTS: Patient[] = [
  { id: 'PT-04821', name: 'Eleanor Whitfield', age: '74F', status: 'Authorized',     assignee: 'Dr. A. Soto',   payer: 'Medicare',      facility: 'Main Campus' },
  { id: 'PT-04822', name: 'Marcus Bell',        age: '39M', status: 'Pending',        assignee: 'Dr. K. Lin',    payer: 'Aetna',         facility: 'North Tower' },
  { id: 'PT-04823', name: 'Priya Raman',        age: '28F', status: 'Registered',     assignee: 'Unassigned',    payer: 'Cigna',         facility: 'Westside Clinic' },
  { id: 'PT-04824', name: 'Theodore Nguyen',    age: '61M', status: 'Authorized',     assignee: 'Dr. M. Okafor', payer: 'Blue Cross',    facility: 'Main Campus' },
  { id: 'PT-04825', name: 'Sofia Castellanos',  age: '45F', status: 'Registered',     assignee: 'Unassigned',    payer: 'United Health', facility: 'Riverside' },
  { id: 'PT-04826', name: 'James Holloway',     age: '52M', status: 'Pending',        assignee: 'Dr. K. Lin',    payer: 'Cigna',         facility: 'North Tower' },
  { id: 'PT-04827', name: 'Amara Diallo',       age: '33F', status: 'Payment Posted', assignee: 'Dr. A. Soto',   payer: 'Aetna',         facility: 'South Pavilion' },
  { id: 'PT-04828', name: 'Walter Kim',         age: '68M', status: 'Payment Posted', assignee: 'Dr. M. Okafor', payer: 'Medicare',      facility: 'Main Campus' },
  { id: 'PT-04829', name: 'Grace Abernathy',    age: '57F', status: 'Registered',     assignee: 'Unassigned',    payer: 'Blue Cross',    facility: 'Westside Clinic' },
  { id: 'PT-04830', name: 'Daniel R. Marsh',    age: '45M', status: 'Completed',      assignee: 'Dr. A. Soto',   payer: 'Aetna',         facility: 'Main Campus' },
  { id: 'PT-04815', name: 'Henry Okonkwo',      age: '36M', status: 'Completed',      assignee: 'Dr. K. Lin',    payer: 'United Health', facility: 'North Tower' },
  { id: 'PT-04812', name: 'Lena Petrova',       age: '41F', status: 'Completed',      assignee: 'Dr. M. Okafor', payer: 'Medicare',      facility: 'Riverside' },
  { id: 'PT-04809', name: 'Owen Fitzgerald',    age: '25M', status: 'Completed',      assignee: 'Dr. A. Soto',   payer: 'Cigna',         facility: 'South Pavilion' },
];
