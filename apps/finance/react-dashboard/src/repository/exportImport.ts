import { ExportBundleSchema } from '../engine/schema';
import type { ExportBundle } from '../engine/schema';
import { migrateStorageBlob } from './localStorageScenarioRepository';

export function downloadExport(bundle: ExportBundle, namePart = 'export'): void {
  const slug = namePart
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'export';
  const filename = `retirement-planner-${slug}-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export type ImportParseResult = { ok: true; bundle: ExportBundle } | { ok: false; issues: string[] };

/** Shared with the LocalStorage repository's read-path validation - one source of truth for "what a valid export looks like." */
export async function parseImportFile(file: File): Promise<ImportParseResult> {
  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, issues: ['Could not read the file.'] };
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, issues: ['File is not valid JSON.'] };
  }

  const versionGuess = typeof json === 'object' && json !== null && 'schemaVersion' in json ? Number((json as { schemaVersion: unknown }).schemaVersion) : 0;
  const migrated = migrateStorageBlob(json, versionGuess);

  const result = ExportBundleSchema.safeParse(migrated);
  if (!result.success) {
    return { ok: false, issues: result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`) };
  }
  return { ok: true, bundle: result.data };
}
