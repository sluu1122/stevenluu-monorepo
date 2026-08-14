import { useRef, useState } from 'react';
import { Check, Pencil, Plus } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragOverEvent,
  type DragStartEvent,
  type DropAnimation,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Button } from '@repo/ui/components/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@repo/ui/components/dialog';
import { useActiveScenario } from '../hooks/useActiveScenario';
import { useDeleteScenario, usePreviewScenarioOrder, useReorderScenarios, useSaveScenario, useScenarios } from '../hooks/useScenarios';
import { createDefaultScenario } from '../engine/defaults';
import { ScenarioRowGhost, SortableScenarioRow } from './SortableScenarioRow';
import type { Scenario } from '../engine/schema';

// Delete/Duplicate act on whichever row's icon button was clicked, not
// necessarily the active scenario - triggered from plain per-row buttons
// rather than a DropdownMenu, which also sidesteps the documented
// DropdownMenu -> Dialog pointerEvents composition bug for this component.
// Renaming lives on the Scenario Setup tab's own Name field instead of here -
// one place to edit a scenario's identity rather than two.
export function ScenarioSwitcher() {
  const { data: scenarios = [] } = useScenarios();
  const { activeScenarioId, setActiveScenarioId } = useActiveScenario();
  const saveScenario = useSaveScenario();
  const deleteScenario = useDeleteScenario();
  const reorderScenarios = useReorderScenarios();
  const previewOrder = usePreviewScenarioOrder();

  const [targetScenario, setTargetScenario] = useState<Scenario | null>(null);
  // Reordering, duplicating and deleting all live behind this rather than on
  // every row. The sidebar is narrow and a scenario name is the one thing that
  // has to stay readable, so the default state spends the full width on it and
  // the controls appear only when they are being used.
  const [isEditing, setIsEditing] = useState(false);
  // Which row is under the cursor right now, so DragOverlay can render a lifted
  // copy of it. That copy is the only thing dnd-kit will give a drop animation
  // to - a row dragged in place just teleports into its slot on release.
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const draggingRow = scenarios.find((s) => s.id === draggingId) ?? null;
  /** The order the drag began from, so a cancelled drag can put the preview back. */
  const orderAtDragStart = useRef<string[] | null>(null);

  /**
   * Fades the lifted copy out where it was released, without moving it.
   *
   * The row underneath is already in its final slot by the time the pointer is
   * released - the list reorders during `onDragEnd` - so there is nothing left
   * for a drop animation to travel to. dnd-kit's default one travels anyway,
   * back to the rect it captured when the drag STARTED, which after a reorder
   * is the slot the row just LEFT: the copy glided away from where the row
   * actually landed. That was a larger and more confusing movement than the
   * small snap it was supposed to smooth over.
   *
   * Fading in place removes the movement entirely rather than trying to aim it.
   */
  const dropAnimation: DropAnimation = {
    duration: 150,
    easing: 'ease-out',
    keyframes: () => [{ opacity: 1 }, { opacity: 0 }],
    // No side effects. dnd-kit's default hides the dragged row for the length
    // of the drop animation and restores it at the end, which is meant for the
    // usual case where the overlay is still travelling to meet it. Here the row
    // is already in its final slot, so hiding it just left a hole under the
    // fading copy and then snapped it back to full opacity a frame before that
    // copy disappeared - two solid rows for one frame, read as a blink. Leaving
    // the row alone turns the same 150ms into a plain cross-fade.
    sideEffects: () => undefined,
  };

  const sensors = useSensors(
    // A short distance so a click still selects the scenario rather than
    // starting a drag the user did not mean.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /**
   * Moves the row as the pointer crosses each neighbour, so the list is already
   * in its final order before the pointer is released.
   *
   * This is what makes the drop silent. Reordering on release instead left a
   * single frame showing the OLD order: dnd-kit clears its drag transforms in
   * its own commit and ours arrived in the next, so for one frame the rows sat
   * at their original positions with nothing transforming them. Nothing can
   * flip on release if nothing changes on release.
   *
   * Cache-only. A drag crosses a row as often as the pointer wanders and none
   * of that is worth a write; `handleDragEnd` persists the result once.
   */
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = scenarios.findIndex((s) => s.id === active.id);
    const newIndex = scenarios.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    previewOrder(arrayMove(scenarios, oldIndex, newIndex).map((s) => s.id));
  }

  function handleDragEnd() {
    setDraggingId(null);

    // The order on screen is already whatever the drag arrived at, so this only
    // has to write it down - and only if the drag actually changed something.
    const ids = scenarios.map((s) => s.id);
    if (orderAtDragStart.current?.join() === ids.join()) return;

    reorderScenarios.mutate(ids);
  }

  async function createScenario() {
    const scenario = createDefaultScenario('CA');
    await saveScenario.mutateAsync(scenario);
    setActiveScenarioId(scenario.id);
  }

  async function duplicateScenario(scenario: Scenario) {
    const now = new Date().toISOString();
    const copy = { ...scenario, id: `scenario_${crypto.randomUUID()}`, name: `${scenario.name} (copy)`, createdAt: now, updatedAt: now };
    await saveScenario.mutateAsync(copy);
    setActiveScenarioId(copy.id);
  }

  async function confirmDelete() {
    if (!targetScenario) return;
    await deleteScenario.mutateAsync(targetScenario.id);
    // ActiveScenarioProvider falls back to the next available scenario on
    // its own once the list re-fetches; clearing it here just triggers that.
    if (targetScenario.id === activeScenarioId) setActiveScenarioId(null);
    setTargetScenario(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="group flex items-center justify-between px-1">
        <span className="text-[11px] font-semibold text-dim uppercase tracking-[0.04em]">Scenarios</span>
        <div className="flex items-center gap-0.5">
          {scenarios.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6 cursor-pointer"
              onClick={() => setIsEditing((editing) => !editing)}
              aria-pressed={isEditing}
              aria-label={isEditing ? 'Done editing scenarios' : 'Edit scenarios'}
            >
              {isEditing ? <Check className="size-3.5" /> : <Pencil className="size-3" />}
            </Button>
          )}
          <Button type="button" variant="ghost" size="icon" className="size-6 cursor-pointer" onClick={() => createScenario()} aria-label="Add new scenario">
            <Plus className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-0.5 max-h-[280px] overflow-y-auto">
        {scenarios.length === 0 && <p className="px-2 py-1.5 text-[13px] text-dim">No scenarios yet</p>}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(event: DragStartEvent) => {
            orderAtDragStart.current = scenarios.map((s) => s.id);
            setDraggingId(String(event.active.id));
          }}
          onDragOver={handleDragOver}
          onDragCancel={() => {
            // The preview has already moved rows around, so an abandoned drag
            // has to put them back rather than leave the list rearranged.
            if (orderAtDragStart.current) previewOrder(orderAtDragStart.current);
            setDraggingId(null);
          }}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={scenarios.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            {scenarios.map((scenario) => (
              <SortableScenarioRow
                key={scenario.id}
                scenario={scenario}
                isActive={scenario.id === activeScenarioId}
                editing={isEditing}
                onSelect={() => setActiveScenarioId(scenario.id)}
                onDuplicate={() => duplicateScenario(scenario)}
                onDelete={() => setTargetScenario(scenario)}
              />
            ))}
          </SortableContext>
          <DragOverlay dropAnimation={dropAnimation}>
            {draggingRow && <ScenarioRowGhost scenario={draggingRow} isActive={draggingRow.id === activeScenarioId} />}
          </DragOverlay>
        </DndContext>
      </div>

      <Dialog open={targetScenario !== null} onOpenChange={(open: boolean) => !open && setTargetScenario(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete "{targetScenario?.name}"?</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-dim">This also deletes any grid overrides saved for this scenario. This can't be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTargetScenario(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
