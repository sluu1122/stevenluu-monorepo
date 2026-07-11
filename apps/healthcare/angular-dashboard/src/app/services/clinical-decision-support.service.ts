import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, timeout } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { MN_TIMEOUT_MS } from '../constants';

export interface MnResult {
  procId:    string;
  payerId:   string;
  pass:      boolean;
  rationale: string;
}

export interface MnRequest {
  procedures: { id: string; cpts: string[]; text?: string }[];
  diagnosis:  { icds: string[]; text?: string };
  insurances: { id: string; payer: string; scope: string }[];
}

@Injectable({ providedIn: 'root' })
export class ClinicalDecisionSupportService {
  private readonly http    = inject(HttpClient);
  private readonly baseUrl = environment.aiApiUrl;

  checkMedicalNecessity(req: MnRequest): Observable<MnResult[]> {
    return this.http
      .post<{ results: MnResult[] }>(`${this.baseUrl}/api/cds/medical-necessity`, req)
      .pipe(
        timeout(MN_TIMEOUT_MS),
        map(r => r.results),
      );
  }
}
