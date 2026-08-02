import { useState } from 'react';
import { ChevronsUpDown, Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@repo/ui/components/dialog';
import { useActiveScenario } from '../hooks/useActiveScenario';
import { useDeleteScenario, useSaveScenario, useScenarios } from '../hooks/useScenarios';
import { createDefaultScenario } from '../engine/defaults';
import type { Country } from '../engine/schema';

type DialogMode = null | 'new' | 'rename' | 'delete';

export function ScenarioSwitcher() {
  const { data: scenarios = [] } = useScenarios();
  const { activeScenarioId, setActiveScenarioId } = useActiveScenario();
  const saveScenario = useSaveScenario();
  const deleteScenario = useDeleteScenario();

  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [renameValue, setRenameValue] = useState('');

  const activeScenario = scenarios.find((s) => s.id === activeScenarioId) ?? null;

  async function createScenario(country: Country) {
    const scenario = createDefaultScenario(country);
    await saveScenario.mutateAsync(scenario);
    setActiveScenarioId(scenario.id);
    setDialogMode(null);
  }

  async function duplicateActive() {
    if (!activeScenario) return;
    const now = new Date().toISOString();
    const copy = { ...activeScenario, id: `scenario_${crypto.randomUUID()}`, name: `${activeScenario.name} (copy)`, createdAt: now, updatedAt: now };
    await saveScenario.mutateAsync(copy);
    setActiveScenarioId(copy.id);
  }

  async function submitRename() {
    if (!activeScenario || !renameValue.trim()) return;
    await saveScenario.mutateAsync({ ...activeScenario, name: renameValue.trim() });
    setDialogMode(null);
  }

  async function confirmDelete() {
    if (!activeScenario) return;
    await deleteScenario.mutateAsync(activeScenario.id);
    const remaining = scenarios.filter((s) => s.id !== activeScenario.id);
    setActiveScenarioId(remaining[0]?.id ?? null);
    setDialogMode(null);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="w-full h-auto justify-between gap-2 px-3 py-2 rounded-[9px] border-edge bg-surface text-[13px] font-medium text-ink hover:bg-surface-pressed hover:text-ink"
          >
            <span className="truncate">{activeScenario?.name ?? 'No scenario'}</span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-dim" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[220px]">
          <DropdownMenuLabel>Scenarios</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {scenarios.length === 0 && <div className="px-2 py-1.5 text-[13px] text-dim">No scenarios yet</div>}
          {scenarios.map((scenario) => (
            <DropdownMenuItem key={scenario.id} onSelect={() => setActiveScenarioId(scenario.id)} className={scenario.id === activeScenarioId ? 'font-semibold' : undefined}>
              {scenario.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setDialogMode('new')}>
            <Plus /> New scenario
          </DropdownMenuItem>
          {activeScenario && (
            <>
              <DropdownMenuItem onSelect={duplicateActive}>
                <Copy /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setRenameValue(activeScenario.name);
                  setDialogMode('rename');
                }}
              >
                <Pencil /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDialogMode('delete')} className="text-loss focus:text-loss">
                <Trash2 /> Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

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
            <DialogTitle>Delete "{activeScenario?.name}"?</DialogTitle>
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
    </>
  );
}
