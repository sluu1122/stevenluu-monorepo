# stevenluu-monorepo

A personal full-stack monorepo built with Turborepo. Contains a Next.js portfolio site, a React finance dashboard, an Angular clinical operations dashboard, and a suite of supporting Express APIs.

## Apps

| App | Description | Port | Stack |
|-----|-------------|------|-------|
| `angular-dashboard` | Clinical operations dashboard — worklist, patient intake wizard, patient search | 4200 | Angular 22, PrimeNG, NgRx Signals |
| `react-dashboard` | Finance sandbox — net worth tracker, watchlist, trade simulator | 5173 | React 19, Vite, TanStack Query, Recharts |
| `portfolio` | Personal portfolio and resume site | 3000 | Next.js 16, Tailwind CSS |
| `ai-api` | LLM proxy — streaming chat, payer ID lookup, medical necessity CDS | 3001 | Express, Ollama |
| `cpt-api` | CPT medical procedure code search | 3002 | Express |
| `icd-api` | ICD-10 diagnosis code search | 3003 | Express |
| `patients-api` | Patient data API for the clinical dashboard | 3004 | Express |

## Packages

| Package | Description |
|---------|-------------|
| `@repo/ui` | Shared React component library (Button, Card, Badge, Chart, Input) |
| `@repo/resume-data` | Resume/portfolio content consumed by `portfolio` and `react-dashboard` |
| `@repo/eslint-config` | Shared ESLint configuration |
| `@repo/typescript-config` | Shared `tsconfig.json` presets |

## Prerequisites

- **Node.js** ≥ 24
- **npm** ≥ 11
- **Ollama** *(optional)* — required only for AI features in `angular-dashboard`. Install from [ollama.com](https://ollama.com). The `ai-api` will auto-pull the default model (`qwen2.5-coder:1.5b`) on first run. Without Ollama, all other apps work normally; only the AI-powered features in the clinical dashboard are unavailable.

## Getting started

```sh
npm install
npm run dev
```

All apps start concurrently. See the port table above for each URL.

## Running a single app

```sh
# Angular dashboard only
npm run dev -- --filter=angular-dashboard

# All APIs only
npm run dev -- --filter=ai-api --filter=cpt-api --filter=icd-api --filter=patients-api
```

## Other commands

```sh
npm run build        # build all apps
npm run check-types  # TypeScript check across all packages
npm run lint         # ESLint across all packages
npm run format       # Prettier format
```
