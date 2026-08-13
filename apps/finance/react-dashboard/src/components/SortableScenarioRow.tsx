import { Copy, GripVertical, Trash2 } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@repo/ui/components/button';
import { cn } from '../lib/utils';
import type { Scenario } from '../engine/schema';

/**
 * The row as it appears under the cursor mid-drag, rendered into dnd-kit's
 * DragOverlay rather than in the list.
 *
 * A row dragged in place has no drop animation - dnd-kit clears its transform
 * on release and it teleports the last few pixels into its slot. An overlay is
 * what dnd-kit gives a drop animation to, so the lifted copy eases into
 * position while the real row is already sitting there underneath it.
 *
 * Deliberately not interactive: it exists for the length of a drag, and its
 * buttons would be unreachable anyway.
 */
export function ScenarioRowGhost({ scenario, isActive }: { scenario: Scenario; isActive: boolean }) {
  return (
    <div
      data-scenario-ghost
      className={cn(
        'flex items-center gap-1 rounded-[9px] px-2 py-1.5 text-[13px] cursor-grabbing',
        'bg-surface shadow-lg ring-1 ring-edge',
        isActive ? 'font-semibold text-ink' : 'text-ink-mid',
      )}
    >
      <span className="shrink-0 -ml-1 p-1 text-dim">
        <GripVertical className="size-3.5" />
      </span>
      <span className="truncate flex-1">{scenario.name}</span>
    </div>
  );
}

interface SortableScenarioRowProps {
  scenario: Scenario;
  isActive: boolean;
  /** Reveals the drag handle and the per-row actions. See ScenarioSwitcher for why they are behind a mode. */
  editing: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function SortableScenarioRow({ scenario, isActive, editing, onSelect, onDuplicate, onDelete }: SortableScenarioRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: scenario.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      // Identifies the row independently of which controls happen to be on it,
      // so a test can read the list without first entering edit mode.
      data-scenario-id={scenario.id}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect();
      }}
      className={cn(
        'group flex items-center gap-1 rounded-[9px] px-2 py-1.5 cursor-pointer text-[13px] transition-colors',
        isActive ? 'bg-surface-pressed font-semibold text-ink' : 'text-ink-mid hover:bg-surface-pressed',
        // Faded to read as the gap the row came out of - the lifted copy in the
        // DragOverlay is what follows the cursor, and it sits above this.
        isDragging && 'opacity-30',
      )}
    >
      {editing && (
        <button
          type="button"
          className="shrink-0 -ml-1 p-1 cursor-grab active:cursor-grabbing touch-none text-dim hover:text-ink"
          aria-label={`Drag to reorder ${scenario.name}`}
          // Selecting the scenario is what a click on the row means; the handle
          // is for dragging, so a click that lands on it does nothing.
          onClick={(e) => e.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>
      )}

      <span className="truncate flex-1">{scenario.name}</span>

      {editing && (
        <div className="flex gap-0.5 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            aria-label={`Duplicate ${scenario.name}`}
          >
            <Copy className="size-3" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 cursor-pointer text-loss hover:text-loss"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            aria-label={`Delete ${scenario.name}`}
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
