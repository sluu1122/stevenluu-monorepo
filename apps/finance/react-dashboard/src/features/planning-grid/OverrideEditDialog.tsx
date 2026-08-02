import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@repo/ui/components/dialog';
import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { MoneyInput } from '../../components/MoneyInput';
import type { GridOverride } from '../../engine/schema';

interface OverrideEditDialogProps {
  year: number | null;
  plannedValue: number;
  existingOverride: GridOverride | undefined;
  onClose: () => void;
  onSave: (value: number, note: string) => void;
  onClear: () => void;
}

// Remounted via `key={year}` by the caller whenever the target year changes,
// so its local state below resets fresh per year with no sync effect needed.
export function OverrideEditDialog({ year, plannedValue, existingOverride, onClose, onSave, onClear }: OverrideEditDialogProps) {
  const [value, setValue] = useState<number | undefined>(() => Math.round(existingOverride?.value ?? plannedValue));
  const [note, setNote] = useState(() => existingOverride?.note ?? '');

  return (
    <Dialog open={year !== null} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Override spending - {year}</DialogTitle>
          <DialogDescription>
            Set a one-time nominal spending amount for this year (e.g. a lump-sum expense). Later years keep compounding from the original plan, unaffected.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nominal spending ($)</Label>
            <MoneyInput value={value} onChange={setValue} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. new roof" />
          </div>
        </div>
        <DialogFooter>
          {existingOverride && (
            <Button variant="outline" onClick={onClear}>
              Clear override
            </Button>
          )}
          <Button
            onClick={() => {
              if (value !== undefined) onSave(value, note);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
