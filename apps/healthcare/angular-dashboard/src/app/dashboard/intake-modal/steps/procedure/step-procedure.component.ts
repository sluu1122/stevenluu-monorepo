import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CodeInputComponent } from '../../../../shared/code-input/code-input.component';
import { IntakeProcedure, IntakeWizardStore } from '../../../../stores/intake-wizard.store';
import { CptService, type CptCode } from '../../../../services/cpt.service';
import { createCodeSearch } from '../../../../shared/code-search';

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

  protected readonly procForms = signal<FormGroup[]>(
    [...this.procArray.controls as FormGroup[]]
  );

  private readonly cptSearch      = createCodeSearch<CptCode>(q => this.cptService.search(q), 'CPT');
  protected readonly searching    = this.cptSearch.searching;
  protected readonly searchError  = this.cptSearch.searchError;

  protected readonly procVm = computed(() => {
    const procedures = this.store.procedures();
    const forms      = this.procForms();
    return procedures
      .map((proc, i) => ({ proc, form: forms[i] }))
      .filter((item): item is { proc: typeof item.proc; form: FormGroup } => item.form != null);
  });

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
    return this.cptSearch.suggestionsFor(id);
  }

  protected onCptQuery(id: string, q: string): void {
    this.cptSearch.query(id, q);
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
  }

  validate(): boolean {
    this.procArray.markAllAsTouched();
    this.procArray.updateValueAndValidity();
    return this.procArray.valid;
  }
}
