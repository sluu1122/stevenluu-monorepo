import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface IcdCode {
  code: string;
  description: string;
  category: string;
}

@Injectable({ providedIn: 'root' })
export class IcdService {
  private readonly http    = inject(HttpClient);
  private readonly baseUrl = environment.icdApiUrl;

  search(query: string): Observable<IcdCode[]> {
    return this.http.get<IcdCode[]>(`${this.baseUrl}/api/icd/search`, {
      params: { q: query },
    });
  }
}
