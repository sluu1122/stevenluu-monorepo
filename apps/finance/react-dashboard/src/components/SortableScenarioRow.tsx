import { Copy, GripVertical, Trash2 } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@repo/ui/components/button';
import { cn } from '../lib/utils';
import type { Scenario } from '../engine/schema';

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
        isDragging && 'opacity-50 relative z-10',
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
