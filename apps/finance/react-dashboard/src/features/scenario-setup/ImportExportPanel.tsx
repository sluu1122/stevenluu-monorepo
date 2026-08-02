import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { DashCard } from '../../components/DashCard';
import { Button } from '@repo/ui/components/button';
import { useScenarioRepository } from '../../hooks/useScenarioRepository';
import { useImportScenarios } from '../../hooks/useScenarios';
import { downloadExport, parseImportFile } from '../../repository/exportImport';

export function ImportExportPanel() {
  const repository = useScenarioRepository();
  const importScenarios = useImportScenarios();
  const [isDragging, setIsDragging] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    const bundle = await repository.exportAll();
    downloadExport(bundle);
  }

  async function handleFile(file: File) {
    const result = await parseImportFile(file);
    if (!result.ok) {
      setIssues(result.issues);
      return;
    }
    setIssues([]);
    await importScenarios.mutateAsync({ bundle: result.bundle, mode: 'merge' });
  }

  return (
    <DashCard>
      <h3 className="text-[15px] font-semibold text-ink mb-1">Backup & Restore</h3>
      <p className="text-[12.5px] text-dim mb-4">Export all scenarios and overrides to a JSON file, or drag one in to restore.</p>
      <div className="flex flex-col sm:flex-row gap-3 items-start">
        <Button type="button" variant="outline" onClick={handleExport}>
          <Download className="size-4" /> Export all scenarios
        </Button>

        <div
          role="button"
          tabIndex={0}
          className={`flex-1 w-full border-2 border-dashed rounded-[12px] px-4 py-6 text-center text-[13px] cursor-pointer transition-colors ${
            isDragging ? 'border-indigo bg-indigo-bg text-indigo' : 'border-edge text-dim hover:border-slate'
          }`}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
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
            if (file) handleFile(file);
          }}
        >
          <Upload className="size-4 mx-auto mb-1.5" />
          Drag a backup .json file here, or click to browse
          <input
            ref={inputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = '';
            }}
          />
        </div>
      </div>
      {issues.length > 0 && (
        <ul className="mt-3 text-[12.5px] text-loss list-disc pl-5">
          {issues.map((issue, i) => (
            <li key={i}>{issue}</li>
          ))}
        </ul>
      )}
    </DashCard>
  );
}
