import { config } from './config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OllamaTagsResponse {
  models: Array<{ name: string; size: number }>;
}

interface OllamaPullEvent {
  status: string;
  completed?: number;
  total?: number;
}

interface OllamaChatEvent {
  message?: { content: string };
  done: boolean;
}

export async function isRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${config.ollamaUrl}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function hasModel(model: string): Promise<boolean> {
  try {
    const res  = await fetch(`${config.ollamaUrl}/api/tags`);
    const data = (await res.json()) as OllamaTagsResponse;
    // Ollama names are "model:tag" — match on base name or exact string
    return data.models.some(
      m => m.name === model || m.name === `${model}:latest` || m.name.startsWith(`${model}:`),
    );
  } catch {
    return false;
  }
}

export async function pullModel(
  model: string,
  onProgress: (status: string, pct?: number) => void,
): Promise<void> {
  const res = await fetch(`${config.ollamaUrl}/api/pull`, {
    method:  'POST',
    headers: { 'content-type': 'application/json' },
    body:    JSON.stringify({ name: model, stream: true }),
  });

  if (!res.ok || !res.body) throw new Error(`Pull failed: HTTP ${res.status}`);

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let   buffer  = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const ev  = JSON.parse(line) as OllamaPullEvent;
        const pct = ev.total
          ? Math.round(((ev.completed ?? 0) / ev.total) * 100)
          : undefined;
        onProgress(ev.status, pct);
      } catch { /* non-JSON lines are normal */ }
    }
  }
}

export async function completeChat(
  model: string,
  messages: ChatMessage[],
): Promise<string> {
  const res = await fetch(`${config.ollamaUrl}/api/chat`, {
    method:  'POST',
    headers: { 'content-type': 'application/json' },
    body:    JSON.stringify({ model, messages, stream: false }),
  });

  if (!res.ok) throw new Error(`Ollama chat failed: HTTP ${res.status}`);

  const data = await res.json() as { message?: { content: string } };
  return data.message?.content ?? '';
}

export async function* streamChat(
  model: string,
  messages: ChatMessage[],
  think = false,
): AsyncGenerator<string> {
  const res = await fetch(`${config.ollamaUrl}/api/chat`, {
    method:  'POST',
    headers: { 'content-type': 'application/json' },
    body:    JSON.stringify({ model, messages, stream: true, think }),
  });

  if (!res.ok || !res.body) throw new Error(`Ollama chat failed: HTTP ${res.status}`);

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let   buffer  = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const ev = JSON.parse(line) as OllamaChatEvent;
        if (!ev.done && ev.message?.content) {
          yield ev.message.content;
        }
      } catch { /* ignore */ }
    }
  }
}
