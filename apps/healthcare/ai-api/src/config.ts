export const config = {
  model:          process.env['MODEL']      ?? 'qwen2.5-coder:1.5b',
  ollamaUrl:      process.env['OLLAMA_URL'] ?? 'http://localhost:11434',
  port:           Number(process.env['PORT'] ?? 3001),
  allowedOrigins: ['http://localhost:4200', 'http://localhost:4300'],
} as const;
