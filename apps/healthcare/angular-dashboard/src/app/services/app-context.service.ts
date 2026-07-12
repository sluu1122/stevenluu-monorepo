import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { timeout } from 'rxjs/operators';
import type { CurrentUser, ReferenceData } from '../models/app-context.model';
import { environment } from '../../environments/environment';

const TIMEOUT_MS = 10_000;

@Injectable({ providedIn: 'root' })
export class AppContextService {
  private readonly http    = inject(HttpClient);
  private readonly baseUrl = environment.patientsApiUrl;

  getMe(): Observable<CurrentUser> {
    return this.http
      .get<CurrentUser>(`${this.baseUrl}/api/me`)
      .pipe(timeout(TIMEOUT_MS));
  }

  getReference(): Observable<ReferenceData> {
    return this.http
      .get<ReferenceData>(`${this.baseUrl}/api/reference`)
      .pipe(timeout(TIMEOUT_MS));
  }
}
