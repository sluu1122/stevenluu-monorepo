import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { timeout } from 'rxjs/operators';
import type { Patient } from '../models/patient.model';
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
}
