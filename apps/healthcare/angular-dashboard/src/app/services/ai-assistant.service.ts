import { Injectable, signal, WritableSignal } from '@angular/core';
import { environment } from '../../environments/environment';

export type AiState = 'idle' | 'streaming' | 'done' | 'error';

export interface SuggestOptions {
  system?: string;
  think?:  boolean;
}

export interface AiField {
  state: WritableSignal<AiState>;
  text:  WritableSignal<string>;
  error: WritableSignal<string>;
}

export function createAiField(): AiField {
  return {
    state: signal<AiState>('idle'),
    text:  signal(''),
    error: signal(''),
  };
}

@Injectable({ providedIn: 'root' })
export class AiAssistantService {
  private controller: AbortController | null = null;

  async *stream(prompt: string, options: SuggestOptions = {}, signal?: AbortSignal): AsyncGenerator<string> {
    const response = await fetch(`${environment.aiApiUrl}/api/suggest`, {
      method:  'POST',
      headers: { 'content-type': 'application/json' },
      body:    JSON.stringify({
        prompt,
        system: options.system,
        think:  options.think ?? false,
      }),
      signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`ai-api error: HTTP ${response.status}`);
    }

    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let   buffer  = '';

    outer: while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') break outer;

        try {
          const event = JSON.parse(payload) as Record<string, unknown>;
          if (typeof event['error'] === 'string') throw new Error(event['error']);
          if (typeof event['text']  === 'string') yield event['text'];
        } catch (e) {
          if (e instanceof SyntaxError) continue;
          throw e;
        }
      }
    }
  }

  async fill(field: AiField, prompt: string, options: SuggestOptions = {}): Promise<void> {
    this.controller?.abort();
    this.controller = new AbortController();
    field.text.set('');
    field.error.set('');
    field.state.set('streaming');
    try {
      for await (const chunk of this.stream(prompt, options, this.controller.signal)) {
        field.text.update(s => s + chunk);
      }
      field.state.set('done');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      field.error.set(err instanceof Error ? err.message : 'AI request failed');
      field.state.set('error');
    }
  }

  abort(): void {
    this.controller?.abort();
    this.controller = null;
  }
}
