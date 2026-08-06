import { useFormContext } from 'react-hook-form';
import { RotateCcw } from 'lucide-react';
import { DashCard } from '../../components/DashCard';
import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import { Badge } from '@repo/ui/components/badge';
import { ACCOUNT_KIND_META, US_ACCOUNT_KINDS, CA_ACCOUNT_KINDS } from '../../engine/accountKindMeta';
import type { AccountKind, Scenario } from '../../engine/schema';

/**
 * The age each KIND of account becomes reachable, for the whole scenario.
 *
 * Per kind rather than per account, because the rule being modelled is the
 * government's: a household with three 401(k)s shouldn't be able to give them
 * three different answers. Blank means "use the statutory age" rather than
 * "no restriction" - the two are different, and an account with a real gate
 * silently losing it would let a plan quietly drain a 401(k) at 45.
 */
export function AccountAvailabilityForm() {
  const { watch, setValue } = useFormContext<Scenario>();
  const overrides = watch('accountAvailabilityAges') ?? {};

  function setAge(kind: AccountKind, raw: string) {
    const next = { ...overrides };
    if (raw === '') delete next[kind];
    else next[kind] = Number(raw);
    setValue('accountAvailabilityAges', next, { shouldDirty: true });
  }

  function clearAll() {
    setValue('accountAvailabilityAges', {}, { shouldDirty: true });
  }

  const hasOverrides = Object.keys(overrides).length > 0;

  return (
    <DashCard>
      <div className="flex items-start justify-between gap-3 mb-1">
        <h3 className="text-[15px] font-semibold text-ink">Account Availability Ages</h3>
        {hasOverrides && (
          <Button type="button" variant="ghost" size="sm" className="cursor-pointer text-dim hover:text-ink shrink-0" onClick={clearAll}>
            <RotateCcw className="size-3.5" /> Reset to statutory
          </Button>
        )}
      </div>
      <p className="text-[12.5px] text-dim mb-4">
        The age each kind of account can first be drawn from. This gates every withdrawal — the spending waterfall, meltdown rules, and cash-buffer
        replenishment alike. Leave blank to use the statutory age shown.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        {[...CA_ACCOUNT_KINDS, ...US_ACCOUNT_KINDS].map((kind) => {
          const meta = ACCOUNT_KIND_META[kind];
          const statutory = meta.defaultAvailableFromAge;
          const overridden = Object.prototype.hasOwnProperty.call(overrides, kind);
          const value = overridden ? (overrides[kind] ?? '') : '';
          return (
            <div key={kind} className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-ink flex items-center gap-1.5 min-w-0">
                <span className="truncate">{meta.label}</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                  {meta.country}
                </Badge>
              </span>
              <div className="flex items-center gap-2 shrink-0">
                {overridden && <span className="text-[11px] text-dim">was {statutory === null ? 'any age' : statutory}</span>}
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  className="w-24"
                  placeholder={statutory === null ? 'Any age' : String(statutory)}
                  value={value}
                  onChange={(e) => setAge(kind, e.target.value)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </DashCard>
  );
}
