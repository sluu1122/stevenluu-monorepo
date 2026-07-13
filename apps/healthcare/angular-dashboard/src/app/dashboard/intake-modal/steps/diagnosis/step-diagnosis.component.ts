import { Component, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CodeInputComponent } from '../../../../shared/code-input/code-input.component';
import { IntakeWizardStore } from '../../../../stores/intake-wizard.store';
import { IcdService, IcdCode } from '../../../../services/icd.service';
import { createCodeSearch } from '../../../../shared/code-search';

const DX_KEY = 'dx';

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
  private readonly icdService = inject(IcdService);

  protected readonly form = this.fb.group({
    icds: [this.store.dxIcds() as string[]],
    text: [this.store.dxText()],
  }, { validators: atLeastOneRequired });

  private readonly icdSearch = createCodeSearch<IcdCode>(q => this.icdService.search(q), 'ICD');
  protected readonly searching   = this.icdSearch.searching;
  protected readonly searchError = this.icdSearch.searchError;

  protected get icdSuggestions(): IcdCode[] {
    return this.icdSearch.suggestionsFor(DX_KEY);
  }

  constructor() {
    this.form.get('icds')!.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(codes => this.store.setDxIcds(codes ?? []));

    this.form.get('text')!.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(val => this.store.setDxText(val ?? ''));
  }

  protected onIcdQuery(q: string): void {
    this.icdSearch.query(DX_KEY, q);
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
