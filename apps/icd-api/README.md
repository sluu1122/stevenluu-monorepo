# icd-api

ICD-10 diagnosis code search API used by the patient intake wizard.

**URL:** http://localhost:3003

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/icd/search?q=<query>&limit=<n>` | Search ICD-10 codes by code or description |

## Configuration

| Env var | Default | Description |
|---------|---------|-------------|
| `PORT` | `3003` | Server port |

Rate limited to 60 requests per minute per IP.

## Dev

```sh
npm run dev -- --filter=icd-api
```
