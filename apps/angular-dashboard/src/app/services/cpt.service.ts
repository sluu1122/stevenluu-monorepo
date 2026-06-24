import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { CptCode } from '../data/cpt-codes';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CptService {
  private readonly http    = inject(HttpClient);
  private readonly baseUrl = environment.cptApiUrl;

  search(query: string): Observable<CptCode[]> {
    return this.http.get<CptCode[]>(`${this.baseUrl}/api/cpt/search`, {
      params: { q: query },
    });
  }
}
