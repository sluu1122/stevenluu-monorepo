# ai-api

LLM proxy for the clinical dashboard. Wraps a local [Ollama](https://ollama.com) model and exposes streaming chat, payor ID lookup, and medical necessity CDS endpoints.

**URL:** http://localhost:3001

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Returns `{ status, model }` |
| POST | `/api/suggest` | Streaming SSE chat — payor ID lookup and general AI suggestions |
| POST | `/api/cds/medical-necessity` | Non-streaming CDS check — returns pass/fail + rationale per procedure/payor pair |

## Configuration

| Env var | Default | Description |
|---------|---------|-------------|
| `MODEL` | `qwen2.5-coder:1.5b` | Ollama model to use |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama base URL |
| `PORT` | `3001` | Server port |

To swap models, set the `MODEL` env var or edit `src/config.ts`. The model is auto-pulled from Ollama on first run if not already present locally.

## Startup behaviour

On `dev` start, the server:
1. Checks if Ollama is already running
2. If not, attempts to launch it via `ollama serve`
3. If Ollama isn't installed, exits with a clear error message — all other apps continue normally
4. Pulls the configured model if it isn't present locally (one-time download)

## Dev

```sh
# From the monorepo root:
npm run dev -- --filter=ai-api
```

Requires [Ollama](https://ollama.com) to be installed.
