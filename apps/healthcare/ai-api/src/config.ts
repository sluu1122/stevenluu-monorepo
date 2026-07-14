export const config = {
  model:          process.env['MODEL']      ?? 'qwen2.5-coder:1.5b',
  ollamaUrl:      process.env['OLLAMA_URL'] ?? 'http://localhost:11434',
  port:           Number(process.env['PORT'] ?? 3001),
  allowedOrigins: (process.env['ALLOWED_ORIGINS'] ?? 'http://localhost:4200,http://localhost:4300').split(','),
  // CPU-only inference on low-power hardware (e.g. a NAS) can take well over a
  // minute for the first request while the model loads into memory.
  chatTimeoutMs:  Number(process.env['OLLAMA_TIMEOUT_MS'] ?? 120_000),
  // Passed to Ollama so the model stays resident between requests instead of
  // paying the load cost every time.
  keepAlive:      process.env['OLLAMA_KEEP_ALIVE'] ?? '2h',
} as const;
