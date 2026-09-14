import { Button } from '@repo/ui/components/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@repo/ui/components/dialog';
import type { Country } from '../engine/schema';

interface NewScenarioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (country: Country) => void;
}

/**
 * Asks for tax residency before creating a scenario.
 *
 * Both entry points used to hardcode 'CA', which is not a choice that corrects
 * itself later: `createDefaultScenario` keys FIVE things off this flag - the
 * account kinds, the currency, the benefits, the federal table and the
 * state/provincial table - while the Tax residency control in Global
 * Parameters regenerates only the two tax tables. So a US user who created a
 * scenario and then switched residency was still left holding Canadian
 * accounts, CAD, CPP and OAS to clear out by hand. Asking once, up front, is
 * the only point at which honouring the answer is free.
 *
 * This picks a STARTING POINT, not a restriction. Every scenario can hold
 * accounts from either country whatever is chosen here, and the account picker
 * is never filtered by it - a US resident can hold an RRSP, and the
 * cross-border demo does exactly that.
 */
export function NewScenarioDialog({ open, onOpenChange, onChoose }: NewScenarioDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>New scenario</DialogTitle>
          <DialogDescription>
            Where does this household pay tax? This sets the starting accounts, currency, benefits and tax tables. You can change all of it later, and
            add accounts from either country whichever you pick.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          <Button type="button" variant="outline" className="cursor-pointer h-auto py-3 flex-col items-start gap-0.5" onClick={() => onChoose('US')}>
            <span className="text-[13px] font-semibold">United States</span>
            <span className="text-[11.5px] font-normal text-dim">401(k)/IRA, Roth, brokerage · USD</span>
          </Button>
          <Button type="button" variant="outline" className="cursor-pointer h-auto py-3 flex-col items-start gap-0.5" onClick={() => onChoose('CA')}>
            <span className="text-[13px] font-semibold">Canada</span>
            <span className="text-[11.5px] font-normal text-dim">RRSP/RRIF, TFSA, non-registered · CAD</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
