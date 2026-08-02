import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@repo/ui/components/sheet';
import { formatCurrency } from '../../lib/format';
import type { LedgerYearRow } from '../../engine/types';
import type { Currency } from '../../engine/schema';

interface FormulaBreakdownSheetProps {
  row: LedgerYearRow | null;
  currency: Currency;
  onClose: () => void;
}

export function FormulaBreakdownSheet({ row, currency, onClose }: FormulaBreakdownSheetProps) {
  return (
    <Sheet open={row !== null} onOpenChange={(open: boolean) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{row ? `${row.year} (age ${row.age})` : ''}</SheetTitle>
          <SheetDescription>Exact formula breakdown for every value computed this row, in calculation order.</SheetDescription>
        </SheetHeader>
        {row && (
          <div className="mt-4 flex flex-col gap-3">
            {row.audit.steps.length === 0 && <p className="text-[13px] text-dim">Nothing to compute this year.</p>}
            {row.audit.steps.map((step, index) => (
              <div key={index} className="rounded-[10px] border border-edge bg-surface-muted px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-ink">{step.label}</span>
                  <span className="text-[13px] font-mono font-semibold text-indigo">{formatCurrency(step.result, currency)}</span>
                </div>
                <p className="mt-1 text-[11.5px] font-mono text-dim">{step.formula}</p>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate">
                  {Object.entries(step.inputs).map(([key, val]) => (
                    <span key={key}>
                      {key}: <span className="font-mono">{Number.isFinite(val) ? val.toLocaleString() : '∞'}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
