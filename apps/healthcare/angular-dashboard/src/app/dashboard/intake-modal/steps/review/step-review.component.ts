import { Component, inject, computed } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { IntakeWizardStore, RANK_NAMES, procLabel } from '../../../../stores/intake-wizard.store';

@Component({
  selector: 'app-intake-step-review',
  standalone: true,
  imports: [ButtonModule],
  templateUrl: './step-review.component.html',
})
export class StepReviewComponent {
  protected readonly store = inject(IntakeWizardStore);

  protected readonly reviewDx = computed(() => ({
    text:  this.store.dxText().trim() || '—',
    codes: this.store.dxIcds().join(', ') || '—',
  }));

  protected readonly reviewPx = computed(() =>
    this.store.procedures().map(p => ({
      id:    p.id,
      text:  p.text.trim() || '—',
      codes: p.cpts.join(', ') || '—',
    }))
  );

  protected readonly reviewIns = computed(() => {
    const procs = this.store.procedures();
    return this.store.insurances().map((w, i) => {
      const scope = w.scopeAll
        ? 'All procedures'
        : w.procIds.length
          ? w.procIds.map(id => {
              const idx = procs.findIndex(p => p.id === id);
              return idx !== -1 ? procLabel(procs[idx], idx) : 'Procedure';
            }).join(', ')
          : 'No procedures selected';
      return {
        id:    w.id,
        rank:  RANK_NAMES[i] ?? `Insurance ${i + 1}`,
        payor: w.payor,
        scope,
      };
    });
  });

  protected readonly mnSummary = computed(() => {
    if (!this.store.mnRun()) {
      return {
        variant: 'skipped' as const,
        icon:  'remove_done',
        title: 'Medical necessity check skipped',
        sub:   'No automated determination was run for this intake.',
      };
    }

    const results = this.store.mnResults();
    const total   = results.length;
    const flagged = results.filter(r => !r.pass).length;

    if (total === 0) {
      return {
        variant: 'skipped' as const,
        icon:  'info',
        title: 'No results returned',
        sub:   'The medical necessity check ran but returned no results.',
      };
    }

    if (flagged > 0) {
      return {
        variant: 'warning' as const,
        icon:  'warning',
        title: `${flagged} of ${total} checks need review`,
        sub:   'Some procedure/payor combinations require manual medical-necessity review.',
      };
    }

    return {
      variant: 'success' as const,
      icon:  'verified',
      title: `All ${total} checks meet criteria`,
      sub:   'Every procedure satisfies medical-necessity requirements for the selected payors.',
    };
  });
}
