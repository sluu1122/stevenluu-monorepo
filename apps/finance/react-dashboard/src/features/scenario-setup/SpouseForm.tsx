import { Controller, useFormContext } from 'react-hook-form';
import { DashCard } from '../../components/DashCard';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { Switch } from '@repo/ui/components/switch';
import type { Scenario } from '../../engine/schema';

export function SpouseForm() {
  const { control, register, watch, setValue } = useFormContext<Scenario>();
  const spouse = watch('spouse');

  return (
    <DashCard>
      <h3 className="text-[15px] font-semibold text-ink mb-1">Spouse</h3>
      <p className="text-[12.5px] text-dim mb-4">
        Adding a spouse gives them their own birth year (their benefit claim age resolves against it independently) and their own planned retirement year. Accounts stay one shared household pool - add their income or a benefit for them in Pensions &amp; Benefits below.
      </p>
      <div className="flex items-center gap-3 mb-4">
        <Switch
          checked={!!spouse}
          onCheckedChange={(checked: boolean) =>
            setValue('spouse', checked ? { birthYear: new Date().getFullYear() - 35, retirementYear: null } : null, { shouldDirty: true })
          }
        />
        <Label className="!mt-0">{spouse ? 'Included' : 'Not included'}</Label>
      </div>
      {spouse && (
        <div className="grid grid-cols-2 gap-4 max-w-[440px]">
          <div className="space-y-1.5">
            <Label>Spouse&apos;s birth year</Label>
            <Input
              type="number"
              {...register('spouse.birthYear', {
                setValueAs: (v) => (v === '' ? undefined : Math.round(Number(v))),
              })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Spouse&apos;s planned retirement year</Label>
            <Controller
              control={control}
              name="spouse.retirementYear"
              render={({ field }) => (
                <Input
                  type="number"
                  placeholder="Not set"
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value === '' ? null : Math.round(Number(e.target.value)))}
                />
              )}
            />
          </div>
        </div>
      )}
    </DashCard>
  );
}
