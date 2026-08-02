import { Badge } from '@repo/ui/components/badge';

export function CellOverrideBadge() {
  return (
    <Badge variant="outline" className="ml-1.5 px-1 py-0 text-[9px] leading-4 border-indigo/40 text-indigo bg-indigo-bg align-middle">
      edited
    </Badge>
  );
}
