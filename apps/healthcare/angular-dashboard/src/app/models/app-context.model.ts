import type { AuthType, InsuranceRank } from './patient.model';

export interface CurrentUser {
  id: string;
  name: string;
  role: string;
  email: string;
}

export interface ReferenceData {
  payers: string[];
  planTypes: string[];
  authTypes: AuthType[];
  noteCategories: string[];
  insuranceRanks: InsuranceRank[];
  providers: string[];
}
