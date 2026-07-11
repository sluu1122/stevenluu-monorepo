# angular-dashboard

Clinical operations dashboard built with Angular 22 and PrimeNG. Covers the core healthcare revenue-cycle workflow: patient intake, insurance authorization, and case management.

**URL:** http://localhost:4200

## Features

- **Worklist** — Active operations queue with KPI tiles, status filtering, AI-powered case summaries streamed from `ai-api`, and a PrimeNG row action menu
- **Patient Intake** — Multi-step wizard (patient info → procedure → insurance → review) with CPT/ICD typeahead, payer ID assistant, and medical necessity CDS check
- **Patient Search** — Facility-wide directory with search by name, MRN, DOB, or phone, plus payer and status filters

## Stack

- Angular 22 (standalone components, control flow syntax)
- NgRx Signals (`signalStore`, `withHooks`, `withMethods`)
- PrimeNG 21 (Table, Menu, Popover, AutoComplete, form controls)
- RxJS

## API dependencies

| API | Port | Used for |
|-----|------|----------|
| `patients-api` | 3004 | Worklist patient data (loaded on init) |
| `cpt-api` | 3002 | CPT code typeahead in the intake wizard |
| `icd-api` | 3003 | ICD-10 typeahead in the intake wizard |
| `ai-api` | 3001 | Payer ID assistant, medical necessity CDS, case summaries |

`ai-api` requires [Ollama](https://ollama.com). Without it, the three AI features degrade gracefully — all other functionality remains available.

## Dev

```sh
# From the monorepo root (starts all services):
npm run dev

# Angular only:
npm run dev -- --filter=angular-dashboard
```
