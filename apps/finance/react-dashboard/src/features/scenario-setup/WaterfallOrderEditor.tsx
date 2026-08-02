import { useFormContext } from 'react-hook-form';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '@repo/ui/components/button';
import { DashCard } from '../../components/DashCard';
import type { Scenario } from '../../engine/schema';

export function WaterfallOrderEditor() {
  const { watch, setValue } = useFormContext<Scenario>();
  const waterfall = watch('waterfall');
  const buckets = watch('accountBuckets');

  const sorted = [...waterfall].sort((a, b) => a.order - b.order);

  function move(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;
    const next = [...sorted];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    setValue(
      'waterfall',
      next.map((step, i) => ({ ...step, order: i })),
      { shouldDirty: true },
    );
  }

  return (
    <DashCard>
      <h3 className="text-[15px] font-semibold text-ink mb-1">Withdrawal Waterfall</h3>
      <p className="text-[12.5px] text-dim mb-4">Drawdown order across account buckets during retirement.</p>
      <ol className="flex flex-col gap-1.5 max-w-[420px]">
        {sorted.map((step, index) => {
          const bucket = buckets.find((b) => b.id === step.accountBucketId);
          return (
            <li
              key={step.accountBucketId}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-[9px] bg-surface-muted text-[13px] text-ink"
            >
              <span>
                {index + 1}. {bucket?.label ?? step.accountBucketId}
              </span>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="icon" className="size-7" disabled={index === 0} onClick={() => move(index, -1)}>
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  disabled={index === sorted.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown className="size-3.5" />
                </Button>
              </div>
            </li>
          );
        })}
      </ol>
    </DashCard>
  );
}
