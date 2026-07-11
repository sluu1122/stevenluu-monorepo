import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, TimeoutError, of } from 'rxjs';
import { debounceTime, switchMap, catchError, map, timeout } from 'rxjs/operators';
import { CodeInputComponent } from '../../../../shared/code-input/code-input.component';
import { IntakeProcedure, IntakeWizardStore } from '../../../../stores/intake-wizard.store';
import { CptService } from '../../../../services/cpt.service';
import type { CptCode } from '../../../../data/cpt-codes';
import { SEARCH_TIMEOUT_MS } from '../../../../constants';

const MIN_QUERY_LEN = 2;

function cptsRequired(ctrl: AbstractControl): ValidationErrors | null {
  return ((ctrl.value as string[] | null) ?? []).length === 0 ? { required: true } : null;
}

@Component({
  selector: 'app-intake-step-procedure',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonModule, CodeInputComponent],
  templateUrl: './step-procedure.component.html',
})
export class StepProcedureComponent {
  protected readonly store = inject(IntakeWizardStore);
  private readonly fb         = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cptService = inject(CptService);

  private readonly procArray = this.fb.array<FormGroup>(
    this.store.procedures().map(p => this.makeProcGroup(p))
  );

  protected readonly procForms    = signal<FormGroup[]>(
    [...this.procArray.controls as FormGroup[]]
  );
  private readonly cptQuery$      = new Subject<{ id: string; q: string }>();
  private readonly suggestionsMap = signal<Record<string, CptCode[]>>({});
  protected readonly searchError  = signal<string | null>(null);
  protected readonly searching    = signal(false);

  protected readonly procVm = computed(() => {
    const procedures = this.store.procedures();
    const forms      = this.procForms();
    return procedures
      .map((proc, i) => ({ proc, form: forms[i] }))
      .filter((item): item is { proc: typeof item.proc; form: FormGroup } => item.form != null);
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.cptQuery$.complete());

    this.cptQuery$.pipe(
      debounceTime(250),
      switchMap(({ id, q }) => {
        if (q.length < MIN_QUERY_LEN) return of({ id, results: [] as CptCode[] });
        this.searching.set(true);
        return this.cptService.search(q).pipe(
          timeout(SEARCH_TIMEOUT_MS),
          map(results => ({ id, results })),
          catchError((err: unknown) => {
            const msg = err instanceof TimeoutError
              ? 'CPT search timed out — try again'
              : 'CPT lookup failed. Check your connection.';
            this.searchError.set(msg);
            return of({ id, results: [] as CptCode[] });
          }),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(({ id, results }) => {
      this.searching.set(false);
      this.searchError.set(null);
      this.suggestionsMap.update(m => ({ ...m, [id]: results }));
    });
  }

  private makeProcGroup(p: IntakeProcedure): FormGroup {
    const g = this.fb.group({
      cpts: [p.cpts as string[], [cptsRequired]],
      text: [p.text],
    });
    g.get('cpts')!.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(cpts => this.store.setProcCpts(p.id, cpts ?? []));
    g.get('text')!.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(val => this.store.setProcedureText(p.id, val ?? ''));
    return g;
  }

  protected cptSuggestions(id: string): CptCode[] {
    return this.suggestionsMap()[id] ?? [];
  }

  protected onCptQuery(id: string, q: string): void {
    if (!q) {
      this.suggestionsMap.update(m => ({ ...m, [id]: [] }));
      this.searching.set(false);
      return;
    }
    this.cptQuery$.next({ id, q });
  }

  protected addProcedure(): void {
    this.store.addProcedure();
    const procs = this.store.procedures();
    this.procArray.push(this.makeProcGroup(procs[procs.length - 1]));
    this.procForms.set([...this.procArray.controls as FormGroup[]]);
  }

  protected removeProcedure(id: string): void {
    const index = this.store.procedures().findIndex(p => p.id === id);
    if (index === -1) return;
    this.store.removeProcedure(id);
    this.procArray.removeAt(index);
    this.procForms.set([...this.procArray.controls as FormGroup[]]);
    this.suggestionsMap.update(m => { const n = { ...m }; delete n[id]; return n; });
  }

  validate(): boolean {
    this.procArray.markAllAsTouched();
    this.procArray.updateValueAndValidity();
    return this.procArray.valid;
  }
}
