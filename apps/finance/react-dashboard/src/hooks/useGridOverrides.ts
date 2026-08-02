import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useScenarioRepository } from './useScenarioRepository';
import type { GridOverride } from '../engine/schema';

function overridesKey(scenarioId: string | undefined) {
  return ['overrides', scenarioId] as const;
}

export function useGridOverrides(scenarioId: string | undefined) {
  const repository = useScenarioRepository();
  return useQuery({
    queryKey: overridesKey(scenarioId),
    queryFn: () => repository.listOverrides(scenarioId!),
    enabled: scenarioId !== undefined,
  });
}

export function useSaveOverride(scenarioId: string | undefined) {
  const repository = useScenarioRepository();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (override: GridOverride) => repository.saveOverride(override),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: overridesKey(scenarioId) }),
  });
}

export function useDeleteOverride(scenarioId: string | undefined) {
  const repository = useScenarioRepository();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repository.deleteOverride(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: overridesKey(scenarioId) }),
  });
}
