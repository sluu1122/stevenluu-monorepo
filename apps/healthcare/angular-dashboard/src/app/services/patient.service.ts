import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { timeout } from 'rxjs/operators';
import type { Patient, DirectoryRecord, NewPatientInput } from '../models/patient.model';
import { environment } from '../../environments/environment';

const TIMEOUT_MS = 10_000;

@Injectable({ providedIn: 'root' })
export class PatientService {
  private readonly http    = inject(HttpClient);
  private readonly baseUrl = environment.patientsApiUrl;

  getPatients(): Observable<Patient[]> {
    return this.http
      .get<Patient[]>(`${this.baseUrl}/api/patients`)
      .pipe(timeout(TIMEOUT_MS));
  }

  getDirectory(): Observable<DirectoryRecord[]> {
    return this.http
      .get<DirectoryRecord[]>(`${this.baseUrl}/api/directory`)
      .pipe(timeout(TIMEOUT_MS));
  }

  addPatient(input: NewPatientInput): Observable<Patient> {
    return this.http
      .post<Patient>(`${this.baseUrl}/api/patients`, input)
      .pipe(timeout(TIMEOUT_MS));
  }

  assignPatient(id: string, assignee: string): Observable<Patient> {
    return this.http
      .put<Patient>(`${this.baseUrl}/api/patients/${id}/assignee`, { assignee })
      .pipe(timeout(TIMEOUT_MS));
  }
}
