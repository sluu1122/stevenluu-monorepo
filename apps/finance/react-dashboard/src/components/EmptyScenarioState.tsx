import { Plus } from 'lucide-react';
import { Button } from '@repo/ui/components/button';
import { DashCard } from './DashCard';
import { NewScenarioDialog } from './NewScenarioDialog';
import { useState } from 'react';
import { useActiveScenario } from '../hooks/useActiveScenario';
import { useSaveScenario } from '../hooks/useScenarios';
import { createDefaultScenario } from '../engine/defaults';
import type { Country } from '../engine/schema';

/**
 * What the output tabs show when there is no scenario to show.
 *
 * Each of these used to be a sentence telling you to go and do something on
 * another tab - a dead end in a place the user had already arrived expecting
 * something. The instruction was also the only thing standing between them and
 * a working app, so it may as well be the button.
 */
export function EmptyScenarioState({ what }: { what: string }) {
  const { setActiveScenarioId } = useActiveScenario();
  const saveScenario = useSaveScenario();
  const [isCreating, setIsCreating] = useState(false);

  async function create(country: Country) {
    setIsCreating(false);
    const scenario = createDefaultScenario(country);
    await saveScenario.mutateAsync(scenario);
    setActiveScenarioId(scenario.id);
  }

  return (
    <DashCard className="text-center py-12">
      <p className="mb-1 text-ink">No scenario yet.</p>
      <p className="mb-4 text-[12.5px] text-dim">Create one to see {what}.</p>
      <div className="flex justify-center">
        <Button className="cursor-pointer" onClick={() => setIsCreating(true)}>
          <Plus className="size-4" /> Create a scenario
        </Button>
      </div>
      <NewScenarioDialog open={isCreating} onOpenChange={setIsCreating} onChoose={create} />
    </DashCard>
  );
}
