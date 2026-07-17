import { Badge } from '@repo/ui/components/badge';
import { Button } from '@repo/ui/components/button';

interface DashboardHeaderProps {
  onMenuClick: () => void;
}

export function DashboardHeader({ onMenuClick }: DashboardHeaderProps) {
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <header
      className="sticky top-0 z-10 border-b border-edge h-[60px] flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-8"
      style={{ background: 'rgba(247,248,250,0.82)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="lg:hidden w-9 h-9 -ml-1 rounded-[9px] text-ink hover:bg-surface-pressed hover:text-ink shrink-0 [&_svg]:size-[18px]"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </Button>
        <div className="min-w-0">
          <h1 className="m-0 text-[17px] font-bold tracking-[-0.02em] text-ink leading-none">Overview</h1>
          <p className="m-0 text-[11.5px] text-dim font-mono mt-0.5">{dateStr}</p>
        </div>
      </div>

      <Badge variant="outline" className="flex items-center gap-[7px] px-3 py-1.5 rounded-full border-gain-border bg-gain-bg shrink-0">
        <span
          className="w-[7px] h-[7px] rounded-full bg-gain inline-block"
          style={{ animation: 'engine 2.2s ease-in-out infinite' }}
        />
        <span className="text-[11.5px] font-medium text-gain-dark font-mono tracking-[0.01em] whitespace-nowrap hidden md:inline">
          Mock Market Engine: Active · Streaming via Web Memory
        </span>
        <span className="text-[11.5px] font-medium text-gain-dark font-mono tracking-[0.01em] whitespace-nowrap md:hidden">
          Engine Active
        </span>
      </Badge>
    </header>
  );
}
