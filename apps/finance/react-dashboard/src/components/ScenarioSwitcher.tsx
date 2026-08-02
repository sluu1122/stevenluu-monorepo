import { useState } from 'react';
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@repo/ui/components/dialog';
import { useActiveScenario } from '../hooks/useActiveScenario';
import { useDeleteScenario, useSaveScenario, useScenarios } from '../hooks/useScenarios';
import { createDefaultScenario } from '../engine/defaults';
import type { Country, Scenario } from '../engine/schema';

type DialogMode = null | 'new' | 'rename' | 'delete';

// Rename/Delete/Duplicate act on whichever row's icon button was clicked,
// not necessarily the active scenario - triggered from plain per-row
// buttons rather than a DropdownMenu, which also sidesteps the documented
// DropdownMenu -> Dialog pointerEvents composition bug for this component.
export function ScenarioSwitcher() {
  const { data: scenarios = [] } = useScenarios();
  const { activeScenarioId, setActiveScenarioId } = useActiveScenario();
  const saveScenario = useSaveScenario();
  const deleteScenario = useDeleteScenario();

  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [targetScenario, setTargetScenario] = useState<Scenario | null>(null);
  const [renameValue, setRenameValue] = useState('');

  async function createScenario(country: Country) {
    const scenario = createDefaultScenario(country);
    await saveScenario.mutateAsync(scenario);
    setActiveScenarioId(scenario.id);
    setDialogMode(null);
  }

  async function duplicateScenario(scenario: Scenario) {
    const now = new Date().toISOString();
    const copy = { ...scenario, id: `scenario_${crypto.randomUUID()}`, name: `${scenario.name} (copy)`, createdAt: now, updatedAt: now };
    await saveScenario.mutateAsync(copy);
    setActiveScenarioId(copy.id);
  }

  async function submitRename() {
    if (!targetScenario || !renameValue.trim()) return;
    await saveScenario.mutateAsync({ ...targetScenario, name: renameValue.trim() });
    setDialogMode(null);
  }

  async function confirmDelete() {
    if (!targetScenario) return;
    await deleteScenario.mutateAsync(targetScenario.id);
    if (targetScenario.id === activeScenarioId) {
      const remaining = scenarios.filter((s) => s.id !== targetScenario.id);
      setActiveScenarioId(remaining[0]?.id ?? null);
    }
    setDialogMode(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-semibold text-dim uppercase tracking-[0.04em]">Scenarios</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 cursor-pointer"
          onClick={() => setDialogMode('new')}
          aria-label="Add new scenario"
        >
          <Plus className="size-3.5" />
        </Button>
      </div>

      <div className="flex flex-col gap-0.5 max-h-[280px] overflow-y-auto">
        {scenarios.length === 0 && <p className="px-2 py-1.5 text-[13px] text-dim">No scenarios yet</p>}
        {scenarios.map((scenario) => (
          <div
            key={scenario.id}
            role="button"
            tabIndex={0}
            onClick={() => setActiveScenarioId(scenario.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setActiveScenarioId(scenario.id);
            }}
            className={`group flex items-center justify-between gap-1 rounded-[9px] px-2 py-1.5 cursor-pointer text-[13px] transition-colors ${
              scenario.id === activeScenarioId ? 'bg-surface-pressed font-semibold text-ink' : 'text-ink-mid hover:bg-surface-pressed'
            }`}
          >
            <span className="truncate">{scenario.name}</span>
            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  duplicateScenario(scenario);
                }}
                aria-label={`Duplicate ${scenario.name}`}
              >
                <Copy className="size-3" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setTargetScenario(scenario);
                  setRenameValue(scenario.name);
                  setDialogMode('rename');
                }}
                aria-label={`Rename ${scenario.name}`}
              >
                <Pencil className="size-3" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6 cursor-pointer text-loss hover:text-loss"
                onClick={(e) => {
                  e.stopPropagation();
                  setTargetScenario(scenario);
                  setDialogMode('delete');
                }}
                aria-label={`Delete ${scenario.name}`}
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogMode === 'new'} onOpenChange={(open: boolean) => !open && setDialogMode(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New scenario</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => createScenario('US')}>
              United States
            </Button>
            <Button className="flex-1" variant="outline" onClick={() => createScenario('CA')}>
              Canada
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogMode === 'rename'} onOpenChange={(open: boolean) => !open && setDialogMode(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename scenario</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="scenario-rename">Name</Label>
            <Input id="scenario-rename" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button onClick={submitRename}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogMode === 'delete'} onOpenChange={(open: boolean) => !open && setDialogMode(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete "{targetScenario?.name}"?</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-dim">This also deletes any grid overrides saved for this scenario. This can't be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
