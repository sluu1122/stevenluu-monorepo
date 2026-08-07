import type { ComponentType } from "react"
import { Area, Legend, Line, Tooltip, XAxis, YAxis } from "recharts"

/**
 * recharts@2's bundled type definitions declare these components as class
 * components in a shape that predates @types/react@19's stricter
 * JSX.ElementType checks, so TypeScript rejects them as JSX elements even
 * though they render fine at runtime (recharts@3's newer types don't have
 * this problem, but its internal Redux-based size-reporting has a bug that
 * leaves every chart permanently blank in a production build - see the
 * commit that pinned this version for the full story). Re-exported here as
 * plain ComponentType so JSX usage type-checks; this only patches the
 * compile-time type, not the actual rendered output.
 */
function asComponent<P>(component: unknown): ComponentType<P> {
  return component as ComponentType<P>
}

export const CompatXAxis = asComponent<Record<string, unknown>>(XAxis)
export const CompatYAxis = asComponent<Record<string, unknown>>(YAxis)
export const CompatArea = asComponent<Record<string, unknown>>(Area)
export const CompatLine = asComponent<Record<string, unknown>>(Line)
export const CompatLegend = asComponent<Record<string, unknown>>(Legend)
export const CompatTooltip = asComponent<Record<string, unknown>>(Tooltip)
