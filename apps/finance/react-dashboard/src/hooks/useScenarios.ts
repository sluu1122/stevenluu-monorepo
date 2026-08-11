import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useScenarioRepository } from './useScenarioRepository';
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
