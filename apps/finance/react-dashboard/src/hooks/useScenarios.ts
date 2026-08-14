import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useScenarioRepository } from './useScenarioRepository';
import { reorderById } from '../lib/reorderById';
import type { ExportBundle, Scenario } from '../engine/schema';

const SCENARIOS_KEY = ['scenarios'] as const;

export function useScenarios() {
  const repository = useScenarioRepository();
  return useQuery({ queryKey: SCENARIOS_KEY, queryFn: () => repository.listScenarios() });
}

export function useSaveScenario() {
  const repository = useScenarioRepository();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (scenario: Scenario) => repository.saveScenario(scenario),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SCENARIOS_KEY }),
  });
}

/**
 * Reorders the cached list WITHOUT persisting, for use while a drag is still
 * in progress.
 *
 * Reordering as the pointer crosses each row - rather than once on release -
 * is what keeps the drop silent: by the time the pointer is let go the list is
 * already in its final order, so dnd-kit clearing its drag transforms changes
 * nothing. Reordering on release instead meant the transforms cleared in one
 * commit and the new order arrived in the next, showing the OLD order for a
 * single frame in between.
 *
 * Deliberately cache-only. A drag can cross a row many times and none of those
 * are worth a write; `useReorderScenarios` persists the final order once.
 */
export function usePreviewScenarioOrder() {
  const queryClient = useQueryClient();
  return (orderedIds: string[]) => {
    const current = queryClient.getQueryData<Scenario[]>(SCENARIOS_KEY);
    if (current) queryClient.setQueryData(SCENARIOS_KEY, reorderById(current, orderedIds));
  };
}

/**
 * Applied optimistically, because the list has already animated into its new
 * order by the time this runs - waiting for the write and refetch to confirm it
 * makes the dragged row visibly snap back and then forward again.
 *
 * Uses the same `reorderById` as the repository write, so what the drag shows
 * and what the store ends up holding cannot disagree.
 */
export function useReorderScenarios() {
  const repository = useScenarioRepository();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) => repository.reorderScenarios(orderedIds),
    onMutate: async (orderedIds: string[]) => {
      await queryClient.cancelQueries({ queryKey: SCENARIOS_KEY });
      const previous = queryClient.getQueryData<Scenario[]>(SCENARIOS_KEY);
      if (previous) queryClient.setQueryData(SCENARIOS_KEY, reorderById(previous, orderedIds));
      return { previous };
    },
    onError: (_error, _orderedIds, context) => {
      // Put the list back rather than leaving it showing an order that was
      // never stored.
      if (context?.previous) queryClient.setQueryData(SCENARIOS_KEY, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: SCENARIOS_KEY }),
  });
}

export function useDeleteScenario() {
  const repository = useScenarioRepository();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repository.deleteScenario(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SCENARIOS_KEY }),
  });
}

export function useResetToDemoScenarios() {
  const repository = useScenarioRepository();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (keepIds: string[]) => repository.resetToDemoScenarios(keepIds),
    // Overrides are dropped alongside the scenarios they belonged to, so
    // invalidate everything rather than just the scenario list.
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function useImportScenarios() {
  const repository = useScenarioRepository();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bundle, mode }: { bundle: ExportBundle; mode: 'merge' | 'replace' }) => repository.importAll(bundle, mode),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
