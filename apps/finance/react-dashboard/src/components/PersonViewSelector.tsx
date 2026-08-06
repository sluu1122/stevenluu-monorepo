import { Minus, Plus } from 'lucide-react';
import { Button } from '@repo/ui/components/button';
import { Checkbox } from '@repo/ui/components/checkbox';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/select';
import { useSelectedPerson } from '../hooks/useSelectedPerson';
import type { PersonPlan } from '../engine/schema';

interface PersonViewSelectorProps {
  persons: PersonPlan[];
  /** The person actually being shown - the stored selection may point at another scenario's person. */
  selectedPerson: PersonPlan | null;
  /** Only the Planning Grid lets you edit the selected person's retirement year from here. */
  onRetirementYearChange?: (year: number | null) => void;
}

/**
 * Which person the Planning Grid / Charts / Client Summary are showing, plus
 * (when `onRetirementYearChange` is passed) a retirement-year control for
 * whichever person is currently selected. The person dropdown and combine
 * checkbox only make sense with more than one person; the retirement-year
 * control always shows when its handler is provided.
 */
export function PersonViewSelector({ persons, selectedPerson, onRetirementYearChange }: PersonViewSelectorProps) {
  const { setSelectedPersonId, combined, setCombined } = useSelectedPerson();
  const hasMultiplePersons = persons.length > 1;

  if (!hasMultiplePersons && !onRetirementYearChange) return null;

  function step(delta: number) {
    if (!selectedPerson || !onRetirementYearChange) return;
    const base = selectedPerson.retirementStartYear ?? Math.max(new Date().getFullYear(), selectedPerson.birthYear + 65);
    onRetirementYearChange(base + delta);
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 shrink-0 print:hidden">
      {hasMultiplePersons && (
        <>
          <div className="flex items-center gap-2">
            <Label className="!mt-0 whitespace-nowrap text-[12.5px] text-dim">Showing</Label>
            <Select value={selectedPerson?.id ?? ''} onValueChange={setSelectedPersonId}>
              <SelectTrigger className="cursor-pointer w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {persons.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-ink cursor-pointer">
            <Checkbox checked={combined} onCheckedChange={(checked: boolean) => setCombined(checked)} />
            Combine all persons
          </label>
          {combined && <span className="text-[12px] text-dim">Totals across everyone, on {selectedPerson?.label ?? 'the selected person'}'s age and year axis.</span>}
        </>
      )}
      {onRetirementYearChange && (
        <div className="flex items-center gap-2 sm:ml-auto">
          <Label className="!mt-0 whitespace-nowrap text-[12.5px] text-dim">Retirement year</Label>
          <Button type="button" variant="ghost" size="icon" className="size-7 cursor-pointer" onClick={() => step(-1)} aria-label="Move retirement year earlier">
            <Minus className="size-3.5" />
          </Button>
          <Input
            type="number"
            placeholder="Not set"
            value={selectedPerson?.retirementStartYear ?? ''}
            onChange={(e) => onRetirementYearChange(e.target.value === '' ? null : Math.round(Number(e.target.value)))}
            className="w-24 text-center"
          />
          <Button type="button" variant="ghost" size="icon" className="size-7 cursor-pointer" onClick={() => step(1)} aria-label="Move retirement year later">
            <Plus className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
