import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';

export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof TimeoutError) return 'Request timed out. Check that patients-api is running.';
  if (err instanceof HttpErrorResponse && typeof err.error?.error === 'string') return err.error.error;
  return fallback;
}
