import type { Sex } from '../models/patient.model';

export function sexCode(label: string): Sex {
  return label === 'Male' ? 'M' : label === 'Female' ? 'F' : 'O';
}

export function sexLabel(sex: Sex): 'Male' | 'Female' | 'Other' {
  return sex === 'M' ? 'Male' : sex === 'F' ? 'Female' : 'Other';
}
