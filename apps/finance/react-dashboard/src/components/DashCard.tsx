import type { ComponentProps } from 'react';
import { Card } from '@repo/ui/components/card';
import { cn } from '../lib/utils';

/** shadcn Card styled as this dashboard's standard card surface. */
export function DashCard({ className, ...props }: ComponentProps<typeof Card>) {
  return (
    <Card
      className={cn(
        'rounded-[20px] border-edge bg-surface text-ink shadow-[0_1px_2px_rgba(15,23,42,0.035)] px-4 py-[18px] sm:px-[26px] sm:py-6',
        className,
      )}
      {...props}
    />
  );
}
