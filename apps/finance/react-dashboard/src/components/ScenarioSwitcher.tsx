import { useRef, useState } from 'react';
import { Copy, Download, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@repo/ui/components/dialog';
import { RadioGroup, RadioGroupItem } from '@repo/ui/components/radio-group';
import { useActiveScenario } from '../hooks/useActiveScenario';
import { useDeleteScenario, useImportScenarios, useSaveScenario, useScenarios } from '../hooks/useScenarios';
import { useScenarioRepository } from '../hooks/useScenarioRepository';
import { createDefaultScenario } from '../engine/defaults';
import { downloadExport, parseImportFile } from '../repository/exportImport';
import type { Scenario } from '../engine/schema';

type DialogMode = null | 'rename' | 'delete' | 'import';
type ImportMode = 'merge' | 'replace';

// Rename/Delete/Duplicate act on whichever row's icon button was clicked,
// not necessarily the active scenario - triggered from plain per-row
// buttons rather than a DropdownMenu, which also sidesteps the documented
// DropdownMenu -> Dialog pointerEvents composition bug for this component.
export function ScenarioSwitcher() {
  const { data: scenarios = [] } = useScenarios();
  const { activeScenarioId, setActiveScenarioId } = useActiveScenario();
  const saveScenario = useSaveScenario();
  const deleteScenario = useDeleteScenario();
  const repository = useScenarioRepository();
  const importScenarios = useImportScenarios();

  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [targetScenario, setTargetScenario] = useState<Scenario | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [isDragging, setIsDragging] = useState(false);
  const [importIssues, setImportIssues] = useState<string[]>([]);
  const importInputRef = useRef<HTMLInputElement>(null);

  async function createScenario() {
    const scenario = createDefaultScenario('CA');
    await saveScenario.mutateAsync(scenario);
    setActiveScenarioId(scenario.id);
  }

  async function exportAllScenarios() {
    const bundle = await repository.exportAll();
    downloadExport(bundle, 'all-scenarios');
  }

  async function exportOneScenario(scenario: Scenario) {
    const bundle = await repository.exportScenario(scenario.id);
    downloadExport(bundle, scenario.name);
  }

  function openImportDialog() {
    setImportMode('merge');
    setImportIssues([]);
    setDialogMode('import');
  }

  async function handleImportFile(file: File) {
    const result = await parseImportFile(file);
    if (!result.ok) {
      setImportIssues(result.issues);
      return;
    }
    setImportIssues([]);
    await importScenarios.mutateAsync({ bundle: result.bundle, mode: importMode });
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
      <div className="group flex items-center justify-between px-1">
        <span className="text-[11px] font-semibold text-dim uppercase tracking-[0.04em]">Scenarios</span>
        <div className="flex gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 cursor-pointer opacity-0 group-hover:opacity-100 focus-within:opacity-100"
            onClick={openImportDialog}
            aria-label="Import scenarios"
          >
            <Upload className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 cursor-pointer opacity-0 group-hover:opacity-100 focus-within:opacity-100"
            onClick={() => exportAllScenarios()}
            aria-label="Export all scenarios"
            disabled={scenarios.length === 0}
          >
            <Download className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 cursor-pointer"
            onClick={() => createScenario()}
            aria-label="Add new scenario"
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
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
                  exportOneScenario(scenario);
                }}
                aria-label={`Export ${scenario.name}`}
              >
                <Download className="size-3" />
              </Button>
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

      <Dialog open={dialogMode === 'rename'} onOpenChange={(open: boolean) => !open && setDialogMode(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename scenario</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitRename();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="scenario-rename">Name</Label>
              <Input id="scenario-rename" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
            </div>
            <DialogFooter className="mt-4">
              <Button type="submit" className="cursor-pointer">
                Save
              </Button>
            </DialogFooter>
          </form>
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

      <Dialog open={dialogMode === 'import'} onOpenChange={(open: boolean) => !open && setDialogMode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import scenarios</DialogTitle>
          </DialogHeader>

          <RadioGroup value={importMode} onValueChange={(value: string) => setImportMode(value as ImportMode)} className="gap-3">
            <label className="flex items-start gap-2.5 text-[13px] cursor-pointer">
              <RadioGroupItem value="merge" className="mt-0.5" />
              <span>
                <span className="block text-ink font-medium">Add to my existing scenarios</span>
                <span className="block text-dim">Imported scenarios are added alongside what you already have. Matching IDs are overwritten.</span>
              </span>
            </label>
            <label className="flex items-start gap-2.5 text-[13px] cursor-pointer">
              <RadioGroupItem value="replace" className="mt-0.5" />
              <span>
                <span className="block text-ink font-medium">Replace all existing scenarios</span>
                <span className="block text-loss">Deletes every scenario you currently have and replaces them with the imported file.</span>
              </span>
            </label>
          </RadioGroup>

          <div
            role="button"
            tabIndex={0}
            className={`border-2 border-dashed rounded-[12px] px-4 py-6 text-center text-[13px] cursor-pointer transition-colors ${
              isDragging ? 'border-indigo bg-indigo-bg text-indigo' : 'border-edge text-dim hover:border-slate'
            }`}
            onClick={() => importInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') importInputRef.current?.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files[0];
              if (file) handleImportFile(file);
            }}
          >
            <Upload className="size-4 mx-auto mb-1.5" />
            Drag a backup .json file here, or click to browse
            <input
              ref={importInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImportFile(file);
                e.target.value = '';
              }}
            />
          </div>

          {importIssues.length > 0 && (
            <ul className="text-[12.5px] text-loss list-disc pl-5">
              {importIssues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
