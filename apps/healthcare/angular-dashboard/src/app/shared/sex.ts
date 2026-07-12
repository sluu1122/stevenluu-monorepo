import type { Sex } from '../models/patient.model';

export function sexCode(label: string): Sex {
  return label === 'Male' ? 'M' : label === 'Female' ? 'F' : 'O';
}
