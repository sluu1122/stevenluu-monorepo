# patients-api

Patient data API for the clinical operations dashboard.

**URL:** http://localhost:3004

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/patients` | Returns the full patient list |

## Configuration

| Env var | Default | Description |
|---------|---------|-------------|
| `PORT` | `3004` | Server port |

## Dev

```sh
npm run dev -- --filter=patients-api
```
