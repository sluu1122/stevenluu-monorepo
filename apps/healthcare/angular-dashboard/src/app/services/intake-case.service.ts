import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { timeout } from 'rxjs/operators';
import type { IntakeCase, Demographics, InsuranceInput, NoteInput } from '../models/intake.model';
import { environment } from '../../environments/environment';

const TIMEOUT_MS = 10_000;

@Injectable({ providedIn: 'root' })
export class IntakeCaseService {
  private readonly http    = inject(HttpClient);
  private readonly baseUrl = environment.patientsApiUrl;

  getIntakeCase(patientId: string): Observable<IntakeCase> {
    return this.http
      .get<IntakeCase>(`${this.baseUrl}/api/intake-case/${patientId}`)
      .pipe(timeout(TIMEOUT_MS));
  }

  updateDemographics(patientId: string, demographics: Demographics): Observable<IntakeCase> {
    return this.http
      .put<IntakeCase>(`${this.baseUrl}/api/intake-case/${patientId}/demographics`, demographics)
      .pipe(timeout(TIMEOUT_MS));
  }

  addInsurance(patientId: string, insurance: InsuranceInput): Observable<IntakeCase> {
    return this.http
      .post<IntakeCase>(`${this.baseUrl}/api/intake-case/${patientId}/insurances`, insurance)
      .pipe(timeout(TIMEOUT_MS));
  }

  updateInsurance(patientId: string, id: string, insurance: InsuranceInput): Observable<IntakeCase> {
    return this.http
      .put<IntakeCase>(`${this.baseUrl}/api/intake-case/${patientId}/insurances/${id}`, insurance)
      .pipe(timeout(TIMEOUT_MS));
  }

  deleteInsurance(patientId: string, id: string): Observable<IntakeCase> {
    return this.http
      .delete<IntakeCase>(`${this.baseUrl}/api/intake-case/${patientId}/insurances/${id}`)
      .pipe(timeout(TIMEOUT_MS));
  }

  addNote(patientId: string, note: NoteInput): Observable<IntakeCase> {
    return this.http
      .post<IntakeCase>(`${this.baseUrl}/api/intake-case/${patientId}/notes`, note)
      .pipe(timeout(TIMEOUT_MS));
  }
}
