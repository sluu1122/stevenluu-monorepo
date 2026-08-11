import { useRef, useState } from 'react';
import { AlertTriangle, Download, RotateCcw, Upload } from 'lucide-react';
import { Button } from '@repo/ui/components/button';
import { Checkbox } from '@repo/ui/components/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@repo/ui/components/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/tabs';
import { RadioGroup, RadioGroupItem } from '@repo/ui/components/radio-group';
import { useImportScenarios, useResetToDemoScenarios, useScenarios } from '../hooks/useScenarios';
import { useScenarioRepository } from '../hooks/useScenarioRepository';
import { downloadExport, parseImportFile } from '../repository/exportImport';

type ImportMode = 'merge' | 'replace';

interface ImportExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportExportDialog({ open, onOpenChange }: ImportExportDialogProps) {
  const { data: scenarios = [] } = useScenarios();
  const repository = useScenarioRepository();
  const importScenarios = useImportScenarios();
  const resetScenarios = useResetToDemoScenarios();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [keepIds, setKeepIds] = useState<Set<string>>(new Set());
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [isDragging, setIsDragging] = useState(false);
  const [importIssues, setImportIssues] = useState<string[]>([]);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Everything starts selected and any leftover import state clears each time
  // the dialog opens, so a "did I forget to check something" state never
  // carries over from a prior open. Reset during render (React's documented
  // "adjusting state when a prop changes" pattern) rather than in an effect,
  // which would flash the stale selection for one frame before catching up.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSelectedIds(new Set(scenarios.map((s) => s.id)));
      setImportMode('merge');
      setImportIssues([]);
      // Nothing kept by default: "reset" should mean reset unless you say
      // otherwise, and an opt-in tick is harder to do by accident than an
      // opt-out untick.
      setKeepIds(new Set());
    }
  }

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? new Set(scenarios.map((s) => s.id)) : new Set());
  }

  async function exportSelected() {
    const ids = [...selectedIds];
    const bundle = await repository.exportScenarios(ids);
    const namePart =
      ids.length === scenarios.length ? 'all-scenarios' : ids.length === 1 ? (scenarios.find((s) => s.id === ids[0])?.name ?? 'scenario') : `${ids.length}-scenarios`;
    downloadExport(bundle, namePart);
  }

  async function handleImportFile(file: File) {
    const result = await parseImportFile(file);
    if (!result.ok) {
      setImportIssues(result.issues);
      return;
    }
    setImportIssues([]);
    await importScenarios.mutateAsync({ bundle: result.bundle, mode: importMode });
    onOpenChange(false);
  }

  async function resetToDemos() {
    await resetScenarios.mutateAsync([...keepIds]);
    onOpenChange(false);
  }

  const allSelected = scenarios.length > 0 && selectedIds.size === scenarios.length;
  const someSelected = selectedIds.size > 0 && !allSelected;
  const deleteCount = scenarios.filter((s) => !keepIds.has(s.id)).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import / Export</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="export" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="export" className="cursor-pointer">
              Export
            </TabsTrigger>
            <TabsTrigger value="import" className="cursor-pointer">
              Import
            </TabsTrigger>
            <TabsTrigger value="reset" className="cursor-pointer">
              Reset
            </TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="flex flex-col gap-3">
            {scenarios.length === 0 ? (
              <p className="text-[13px] text-dim py-4 text-center">No scenarios to export yet.</p>
            ) : (
              <>
                <label className="flex items-center gap-2.5 text-[13px] px-1 cursor-pointer">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={(checked: boolean | 'indeterminate') => toggleAll(checked === true)}
                  />
                  <span className="font-medium text-ink">Select all</span>
                </label>
                <div className="flex flex-col gap-0.5 max-h-[240px] overflow-y-auto border border-edge rounded-[9px] p-1.5">
                  {scenarios.map((scenario) => (
                    <label key={scenario.id} className="flex items-center gap-2.5 text-[13px] px-1.5 py-1 rounded-[7px] hover:bg-surface-pressed cursor-pointer">
                      <Checkbox checked={selectedIds.has(scenario.id)} onCheckedChange={(checked: boolean | 'indeterminate') => toggleOne(scenario.id, checked === true)} />
                      <span className="truncate text-ink-mid">{scenario.name}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={exportSelected} disabled={selectedIds.size === 0} className="cursor-pointer">
                <Download className="size-3.5" />
                Export{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="import" className="flex flex-col gap-3">
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
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="reset" className="flex flex-col gap-3">
            <div className="flex items-start gap-2.5 border border-loss/30 bg-loss-bg rounded-[9px] p-2.5">
              <AlertTriangle className="size-4 text-loss shrink-0 mt-px" />
              <p className="text-[12.5px] text-loss-dark">
                This deletes every scenario you have, along with its grid overrides, and restores the three demo scenarios. It cannot be undone. Tick
                anything below you want to survive, or export it first from the Export tab.
              </p>
            </div>

            {scenarios.length > 0 && (
              <>
                <p className="text-[12.5px] text-dim px-1">Keep these scenarios:</p>
                <div className="flex flex-col gap-0.5 max-h-[200px] overflow-y-auto border border-edge rounded-[9px] p-1.5">
                  {scenarios.map((scenario) => (
                    <label key={scenario.id} className="flex items-center gap-2.5 text-[13px] px-1.5 py-1 rounded-[7px] hover:bg-surface-pressed cursor-pointer">
                      <Checkbox
                        checked={keepIds.has(scenario.id)}
                        onCheckedChange={(checked: boolean | 'indeterminate') =>
                          setKeepIds((prev) => {
                            const next = new Set(prev);
                            if (checked === true) next.add(scenario.id);
                            else next.delete(scenario.id);
                            return next;
                          })
                        }
                      />
                      <span className="truncate text-ink-mid">{scenario.name}</span>
                    </label>
                  ))}
                </div>
              </>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={resetToDemos} disabled={resetScenarios.isPending} className="cursor-pointer">
                <RotateCcw className="size-3.5" />
                {deleteCount > 0 ? `Delete ${deleteCount} and reset` : 'Reset'}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
