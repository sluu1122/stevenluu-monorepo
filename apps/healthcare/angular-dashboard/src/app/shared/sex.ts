import type { Sex } from '../models/patient.model';

export type SexLabel = 'Male' | 'Female' | 'Other';

export const SEX_LABELS: SexLabel[] = ['Male', 'Female', 'Other'];

export function sexCode(label: string): Sex {
  return label === 'Male' ? 'M' : label === 'Female' ? 'F' : 'O';
}

export function sexLabel(sex: Sex): SexLabel {
  return sex === 'M' ? 'Male' : sex === 'F' ? 'Female' : 'Other';
}
