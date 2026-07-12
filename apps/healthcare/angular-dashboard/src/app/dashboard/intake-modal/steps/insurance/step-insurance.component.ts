import { Component, DestroyRef, inject, signal, computed } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IntakeInsurance, IntakeWizardStore, RANK_NAMES, procLabel } from '../../../../stores/intake-wizard.store';
import { ReferenceStore } from '../../../../stores/reference.store';

@Component({
  selector: 'app-intake-step-insurance',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonModule],
  templateUrl: './step-insurance.component.html',
})
export class StepInsuranceComponent {
  protected readonly store  = inject(IntakeWizardStore);
  protected readonly PAYERS = inject(ReferenceStore).payers;
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  private readonly insArray = this.fb.array<FormGroup>(
    this.store.insurances().map(w => this.makeInsGroup(w))
  );

  protected readonly insForms = signal<FormGroup[]>(
    [...this.insArray.controls as FormGroup[]]
  );

  protected readonly insVm = computed(() => {
    const procs = this.store.procedures();
    const ins   = this.store.insurances();
    const forms = this.insForms();
    return ins.map((w, i) => ({
      ...w,
      rank:       RANK_NAMES[i] ?? `Insurance ${i + 1}`,
      canRemove:  ins.length > 1,
      scopeError: !w.scopeAll && w.procIds.length === 0,
      form:       forms[i],
      procChips:  procs.map((p, pi) => ({
        id:    p.id,
        label: procLabel(p, pi),
        on:    w.procIds.includes(p.id),
      })),
    })).filter((item): item is typeof item & { form: FormGroup } => item.form != null);
  });

  protected readonly mnResultRows = computed(() => {
    if (!this.store.mnRun() || !this.store.mnResults().length) return [];

    const procs     = this.store.procedures();
    const insurances = this.store.insurances();

    const procLabels = procs.reduce((m, p, i) => {
      m[p.id] = procLabel(p, i);
      return m;
    }, {} as Record<string, string>);

    const payerLabels = insurances.reduce((m, w) => {
      m[w.id] = w.payer;
      return m;
    }, {} as Record<string, string>);

    return this.store.mnResults().map(r => ({
      proc:      procLabels[r.procId]  ?? r.procId,
      payer:     payerLabels[r.payerId] ?? r.payerId,
      pass:      r.pass,
      rationale: r.rationale,
    }));
  });

  private makeInsGroup(w: IntakeInsurance): FormGroup {
    const g = this.fb.group({ payer: [w.payer] });
    g.get('payer')!.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(val => this.store.setInsurancePayer(w.id, val ?? ''));
    return g;
  }

  protected addInsurance(): void {
    this.store.addInsurance();
    const ins = this.store.insurances();
    this.insArray.push(this.makeInsGroup(ins[ins.length - 1]));
    this.insForms.set([...this.insArray.controls as FormGroup[]]);
  }

  protected removeInsurance(id: string): void {
    const index = this.store.insurances().findIndex(w => w.id === id);
    if (index === -1) return;
    this.store.removeInsurance(id);
    this.insArray.removeAt(index);
    this.insForms.set([...this.insArray.controls as FormGroup[]]);
  }

  validate(): boolean {
    return this.store.insurances().every(w => w.scopeAll || w.procIds.length > 0);
  }
}
