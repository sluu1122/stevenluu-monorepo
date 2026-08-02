import { ChevronDown, ChevronRight } from 'lucide-react';
import { TableHead } from '@repo/ui/components/table';
import { cn } from '../../lib/utils';

interface LedgerColumnGroupHeaderProps {
  label: string;
  colSpan: number;
  collapsed: boolean;
  onToggle: () => void;
}

export function LedgerColumnGroupHeader({ label, colSpan, collapsed, onToggle }: LedgerColumnGroupHeaderProps) {
  return (
    <TableHead colSpan={colSpan} className="whitespace-nowrap border-l border-edge bg-surface-raised px-2 py-1.5">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-slate hover:text-ink transition-colors',
          collapsed && 'text-dim',
        )}
      >
        {collapsed ? <ChevronRight className="size-3" /> : <ChevronDown className="size-3" />}
        {label}
      </button>
    </TableHead>
  );
}
