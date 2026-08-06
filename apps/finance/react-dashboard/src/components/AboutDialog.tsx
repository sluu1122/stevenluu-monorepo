import { AlertTriangle, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@repo/ui/components/dialog';

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FEATURES = [
  {
    title: 'Household modeling',
    detail: 'Plan for one person or a whole household - each with their own accounts, retirement year, spending, income, and benefits, plus accounts jointly held between people.',
  },
  {
    title: 'Tax-aware withdrawal waterfalls',
    detail: 'A configurable per-person draw order across taxable, tax-deferred, and tax-free accounts, taxed against real US and Canadian bracket tables.',
  },
  {
    title: 'Cash buffer replenishment',
    detail: 'A spending reserve - per-person or shared across a household - topped up automatically from other accounts each year, priced at the correct marginal tax rate.',
  },
  {
    title: 'RRSP/401(k) meltdown strategies',
    detail: 'Optional rules to draw down tax-deferred accounts early to fill a target tax bracket, reinvesting the after-tax proceeds.',
  },
  {
    title: 'Government benefits',
    detail: 'CPP and OAS - with the OAS clawback modeled - or Social Security, claimed on each person’s own schedule.',
  },
  {
    title: 'Full formula breakdown',
    detail: 'Every figure in the Planning Grid opens into an audit trail showing the exact formula and inputs behind it - nothing is a black box.',
  },
  {
    title: 'Charts, summaries, and export',
    detail: 'Net worth over time, scenario comparison, a client-ready printable summary, and CSV/text export for independently checking the numbers.',
  },
  {
    title: 'Local-only',
    detail: 'Everything runs client-side. There’s no account and no server - nothing you enter ever leaves your browser.',
  },
];

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Retirement Planning Engine</DialogTitle>
          <DialogDescription>
            A year-by-year retirement income planner: it sequences withdrawals across accounts and tax treatments, models real tax brackets and government
            benefits, and shows exactly how every number was calculated.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-2.5 rounded-lg border border-edge bg-surface-muted px-3 py-2.5">
          <AlertTriangle className="size-4 text-ink-mid shrink-0 mt-0.5" />
          <p className="text-[12.5px] text-ink-mid leading-[1.45] m-0">
            This is a portfolio/demo project, not a real advisory tool. Figures may be inaccurate or based on simplified assumptions - nothing here is
            financial advice.
          </p>
        </div>
        <ul className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="flex gap-2.5">
              <Check className="size-4 text-indigo shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] font-semibold text-ink m-0">{feature.title}</p>
                <p className="text-[12.5px] text-dim m-0 leading-[1.45]">{feature.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
