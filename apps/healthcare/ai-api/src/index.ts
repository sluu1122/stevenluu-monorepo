import { spawn } from 'child_process';
import { config } from './config';
import { isRunning, hasModel, pullModel } from './ollama';
import { createServer } from './server';

const POLL_MS   = 1500;
const MAX_POLLS = 20;

async function ensureOllama(): Promise<void> {
  if (await isRunning()) {
    console.log('[ai-api] Ollama already running.');
    return;
  }

  console.log('[ai-api] Ollama not detected — starting it...');

  let startError: Error | null = null;
  const proc = spawn('ollama', ['serve'], { stdio: 'ignore' });
  proc.on('error', (err) => {
    const code = (err as NodeJS.ErrnoException).code;
    startError = code === 'ENOENT'
      ? new Error('Ollama is not installed. Download it from ollama.com')
      : new Error(`Failed to start Ollama: ${err.message}`);
  });

  // Give the process a moment to either start or report ENOENT
  await new Promise(r => setTimeout(r, 500));
  if (startError) throw startError;

  // Poll until the HTTP server is accepting requests
  for (let i = 0; i < MAX_POLLS; i++) {
    if (await isRunning()) {
      console.log('[ai-api] Ollama is ready.');
      return;
    }
    await new Promise(r => setTimeout(r, POLL_MS));
  }

  throw new Error('Ollama did not become ready in time.');
}

async function ensureModel(): Promise<void> {
  if (await hasModel(config.model)) {
    console.log(`[ai-api] Model ready: ${config.model}`);
    return;
  }

  console.log(`[ai-api] Model "${config.model}" not found locally — pulling now...`);
  console.log('[ai-api] (This is a one-time download. Swap models in src/config.ts)');

  let lastPct = -1;
  await pullModel(config.model, (status, pct) => {
    if (pct !== undefined && pct !== lastPct) {
      lastPct = pct;
      process.stdout.write(`\r[ai-api] Downloading ${config.model} — ${pct}%   `);
    } else if (pct === undefined) {
      console.log(`\n[ai-api] ${status}`);
    }
  });

  console.log(`\n[ai-api] "${config.model}" is ready.`);
}

async function main(): Promise<void> {
  await ensureOllama();
  await ensureModel();

  const app = createServer();
  app.listen(config.port, () => {
    console.log(`\n[ai-api] Server running at http://localhost:${config.port}`);
    console.log(`[ai-api] Model : ${config.model}`);
    console.log(`[ai-api] Swap  : set MODEL env var or edit src/config.ts — auto-pulls on restart\n`);
  });
}

main().catch(err => {
  console.error('[ai-api] Fatal:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
