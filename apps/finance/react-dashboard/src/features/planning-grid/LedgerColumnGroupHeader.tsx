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
  // The rule under this row is an inset shadow, not `border-b`: the header is
  // sticky and the table is border-collapse, so a real border belongs to the
  // table grid and scrolls away from the header. See LedgerTable's
  // ROW_RULE_SHADOW.
  return (
    <TableHead
      colSpan={colSpan}
      className="whitespace-nowrap border-l border-edge bg-surface-raised px-2 py-1.5"
      style={{ boxShadow: 'inset 0 -1px 0 0 var(--brand-page-fg)' }}
    >
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
