import type { ReferenceData } from './types.js';

export const REFERENCE_DATA: ReferenceData = {
  payers: ['Aetna', 'United Health', 'Cigna', 'Blue Cross', 'Medicare'],
  planTypes: ['PPO — Preferred', 'HMO', 'EPO', 'Part B', 'Medicare Advantage'],
  authTypes: ['Inpatient', 'Outpatient', 'Telehealth'],
  noteCategories: ['Clinical', 'Administrative', 'Insurance', 'Follow-up'],
  insuranceRanks: ['Primary', 'Secondary', 'Tertiary'],
};
