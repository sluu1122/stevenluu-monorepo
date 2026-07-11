# cpt-api

CPT medical procedure code search API used by the patient intake wizard.

**URL:** http://localhost:3002

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/cpt/search?q=<query>&limit=<n>` | Search CPT codes by code or description |

## Configuration

| Env var | Default | Description |
|---------|---------|-------------|
| `PORT` | `3002` | Server port |

Rate limited to 60 requests per minute per IP.

## Dev

```sh
npm run dev -- --filter=cpt-api
```
