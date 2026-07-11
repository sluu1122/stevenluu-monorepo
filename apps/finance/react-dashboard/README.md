# react-dashboard

Finance sandbox dashboard — a personal investment portfolio tracker with a live-updating watchlist and trade simulator.

**URL:** http://localhost:5173

## Features

- **Net worth** — Total portfolio value with a 30-day history chart
- **Watchlist** — Simulated real-time market feed with price ticks
- **Asset allocation** — Breakdown by asset class with a donut chart
- **Trade sandbox** — Buy/sell simulator with order confirmation

## Stack

- React 19, TypeScript
- Vite
- TanStack Query v5 (data fetching and caching)
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
