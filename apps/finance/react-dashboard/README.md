# react-dashboard

A deterministic, dual-country (US/Canada) retirement and financial-scenario planning engine — year-by-year ledger projections with tax-aware withdrawal waterfalls, cash-buffer rules, cell-level overrides with a formula-audit trail, and scenario comparison. All calculation is pure TypeScript running locally in the browser; there is no AI/LLM involved in any projection.

**Live:** https://finance.stevenluu.com
**Dev URL:** http://localhost:5173

## Features

- **Scenario Setup** — global parameters, account buckets (US: Taxable/401(k)/IRA/Roth/Cash; Canada: Non-Registered/RRSP-RRIF/TFSA/Cash), editable 2026 federal tax brackets, withdrawal waterfall ordering, cash-buffer rule, income sources, pensions/benefits, and JSON backup/restore
- **Planning Grid** — full year-by-year ledger with collapsible column groups, a retirement-start selector, per-cell spending overrides, and a formula-breakdown audit sheet for every row
- **Charts & Analytics** — net worth over time, balance by account bucket, and a side-by-side scenario comparison overlay
- **Client Summary** — key metrics and a condensed printable summary

All scenario and override data is stored in browser LocalStorage only (see `src/repository/`); a Drizzle/Postgres schema (`src/db/schema.ts`) exists as forward-looking scaffolding for a future backend, not a live connection.

## Stack

- React 19, TypeScript
- Vite
- TanStack Query v5 (repository read/write caching)
- react-hook-form + Zod (forms and the single schema shared by validation, persistence, and import)
- Recharts (charting)
- Tailwind CSS
- `@repo/ui` (shared shadcn/ui component library)
- `@repo/resume-data` (portfolio content)

## Adding shadcn components

UI components live in `packages/ui` and are shared across apps. To add a new shadcn component to the shared library:

```sh
cd packages/ui
npx shadcn@latest add <component-name>
```

The component is then importable from `@repo/ui/components/<component-name>` in any app that depends on `@repo/ui`.

To add a component only to this app (not shared):

```sh
cd apps/react-dashboard
npx shadcn@latest add <component-name>
```

This places the component in `src/components/ui/` using the local aliases defined in `components.json`.

## Dev

```sh
# From the monorepo root:
npm run dev -- --filter=react-dashboard
```
