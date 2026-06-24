import { Component, DestroyRef, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, TimeoutError, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, timeout } from 'rxjs/operators';
import { CodeInputComponent } from '../../../../shared/code-input/code-input.component';
import { IntakeWizardStore } from '../../../../stores/intake-wizard.store';
import { IcdService, IcdCode } from '../../../../services/icd.service';
import { SEARCH_TIMEOUT_MS } from '../../../../constants';

const MIN_QUERY_LEN = 2;

function atLeastOneRequired(g: AbstractControl): ValidationErrors | null {
  const text = ((g.get('text')?.value as string) ?? '').trim();
  const icds  = (g.get('icds')?.value as string[]) ?? [];
  return text || icds.length > 0 ? null : { atLeastOne: true };
}

@Component({
  selector: 'app-intake-step-diagnosis',
  standalone: true,
  imports: [ReactiveFormsModule, CodeInputComponent],
  templateUrl: './step-diagnosis.component.html',
})
export class StepDiagnosisComponent {
  protected readonly store = inject(IntakeWizardStore);
  private readonly fb         = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly icdService = inject(IcdService);

  protected readonly form = this.fb.group({
    icds: [this.store.dxIcds() as string[]],
    text: [this.store.dxText()],
  }, { validators: atLeastOneRequired });

  private readonly icdQuery$        = new Subject<string>();
  protected readonly icdSuggestions = signal<IcdCode[]>([]);
  protected readonly searchError    = signal<string | null>(null);
  protected readonly searching      = signal(false);

  constructor() {
    this.destroyRef.onDestroy(() => this.icdQuery$.complete());

    this.form.get('icds')!.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(codes => this.store.setDxIcds(codes ?? []));

    this.form.get('text')!.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(val => this.store.setDxText(val ?? ''));

    this.icdQuery$.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap(q => {
        if (q.length < MIN_QUERY_LEN) return of([] as IcdCode[]);
        this.searching.set(true);
        return this.icdService.search(q).pipe(
          timeout(SEARCH_TIMEOUT_MS),
          catchError((err: unknown) => {
            const msg = err instanceof TimeoutError
              ? 'ICD search timed out — try again'
              : 'ICD lookup failed. Check your connection.';
            this.searchError.set(msg);
            return of([] as IcdCode[]);
          }),
        );
      }),
      takeUntilDestroyed(),
    ).subscribe(results => {
      this.searching.set(false);
      this.searchError.set(null);
      this.icdSuggestions.set(results);
    });
  }

  protected onIcdQuery(q: string): void {
    if (!q) { this.icdSuggestions.set([]); this.searching.set(false); return; }
    this.icdQuery$.next(q);
  }

  protected get showError(): boolean {
    return this.form.invalid && (
      (this.form.get('icds')?.touched ?? false) ||
      (this.form.get('text')?.touched ?? false)
    );
  }

  validate(): boolean {
    this.form.get('icds')!.markAsTouched();
    this.form.get('text')!.markAsTouched();
    this.form.updateValueAndValidity();
    return this.form.valid;
  }
}
