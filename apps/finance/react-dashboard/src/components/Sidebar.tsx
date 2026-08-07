import { useEffect, useState } from 'react';
import { ArrowLeftRight, Info, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { resumeData } from '@repo/resume-data';
import { Avatar, AvatarFallback } from '@repo/ui/components/avatar';
import { Button } from '@repo/ui/components/button';
import { Popover, PopoverContent, PopoverTrigger } from '@repo/ui/components/popover';
import { Sheet, SheetContent, SheetTitle } from '@repo/ui/components/sheet';
import { Separator } from '@repo/ui/components/separator';
import { cn } from '../lib/utils';
import { ThemeToggle } from './ThemeToggle';
import { ScenarioSwitcher } from './ScenarioSwitcher';
import { AboutDialog } from './AboutDialog';
import { ImportExportDialog } from './ImportExportDialog';
const BRAND_GRADIENT = 'linear-gradient(135deg, #5B5BD6 0%, #6E6AF0 100%)';

// Mirrors the Angular dashboard's portfolioUrl default (localhost:3000 in dev,
// the live site in prod). No runtime env plumbing needed for a static build.
const PORTFOLIO_URL = import.meta.env.DEV ? 'http://localhost:3000' : 'https://stevenluu.com';

interface SidebarProps {
  /** Drawer visibility below lg; ignored at lg+ where the rail is always shown. */
  open: boolean;
  onClose: () => void;
  /** The active tab's label - shown in place of a static title so it updates as the user navigates. */
  activeLabel: string;
  /** Desktop-only: whether the static rail is shrunk to an icon-only strip. Never affects the mobile drawer, which always shows the full content. */
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

interface SidebarContentProps {
  onNavigate: () => void;
  activeLabel: string;
  onToggleCollapsed: () => void;
}

function SidebarContent({ onNavigate, activeLabel, onToggleCollapsed }: SidebarContentProps) {
  const [aboutOpen, setAboutOpen] = useState(false);
  const [importExportOpen, setImportExportOpen] = useState(false);

  return (
    <>
      {/* Logo + active tab title */}
      <div className="flex items-center gap-2.5 mb-8 pl-1">
        <div
          className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center shrink-0"
          style={{ background: BRAND_GRADIENT }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <polyline points="1,13 5,8 9,10 13,4 17,6" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-[14px] tracking-[-0.02em] text-ink leading-[1.2] m-0 truncate">Retirement Engine</p>
          <p className="font-mono text-[10px] text-dim uppercase tracking-[0.04em] leading-[1.3] m-0 truncate">{activeLabel}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggleCollapsed}
          aria-label="Collapse sidebar"
          className="hidden lg:flex size-7 cursor-pointer text-dim hover:text-ink shrink-0"
        >
          <PanelLeftClose className="size-4" />
        </Button>
      </div>

      <ScenarioSwitcher />

      <div className="flex-1" />

      {/* Bottom */}
      <div className="border-t border-edge pt-4 flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setImportExportOpen(true)}
          className="flex items-center gap-1.5 text-[12.5px] font-medium text-dim hover:text-ink transition-colors cursor-pointer"
        >
          <ArrowLeftRight className="size-3.5" />
          Import / Export
        </button>
        <ThemeToggle />
        <Separator className="bg-edge" />
        <p className="text-[11px] text-dim font-mono tracking-[0.03em] leading-[1.5] m-0">
          Local-only — nothing leaves your browser
        </p>
        <p className="text-[11px] text-dim font-mono tracking-[0.03em] leading-[1.5] m-0">
          Demo only — figures may be inaccurate. Not financial advice.
        </p>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Account menu"
              className="flex items-center gap-[9px] w-full text-left -mx-1.5 px-1.5 py-1 rounded-[9px] transition-colors hover:bg-surface-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo/40"
            >
              <Avatar className="w-[30px] h-[30px]">
                <AvatarFallback
                  className="text-[12px] font-bold text-white"
                  style={{ background: BRAND_GRADIENT }}
                >
                  SL
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-ink tracking-[-0.01em] m-0 truncate">{resumeData.personalInfo.name}</p>
                <p className="text-[11px] text-dim m-0">Financial Planner</p>
              </div>
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="start"
            sideOffset={10}
            collisionPadding={12}
            className="w-auto min-w-[280px] flex flex-col items-center gap-5 px-10 py-8 bg-surface border-edge rounded-2xl shadow-[0_12px_40px_-8px_rgba(15,23,42,0.22)]"
          >
            <span className="max-w-full truncate text-[13px] font-medium text-ink-mid">
              {resumeData.personalInfo.email}
            </span>
            <Avatar className="w-24 h-24">
              <AvatarFallback
                className="text-3xl font-bold text-white"
                style={{ background: BRAND_GRADIENT }}
              >
                SL
              </AvatarFallback>
            </Avatar>
            <Button
              asChild
              variant="outline"
              className="rounded-full h-auto gap-2 px-[18px] py-2.5 text-[13px] font-semibold border-edge text-ink hover:bg-surface-pressed hover:text-ink"
            >
              <a href={PORTFOLIO_URL} onClick={onNavigate}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M9.5 3.5 5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Return to Portfolio
              </a>
            </Button>
            <button
              type="button"
              onClick={() => setAboutOpen(true)}
              className="flex items-center gap-1.5 text-[12.5px] font-medium text-dim hover:text-ink transition-colors cursor-pointer"
            >
              <Info className="size-3.5" />
              About this tool
            </button>
          </PopoverContent>
        </Popover>
        <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
        <ImportExportDialog open={importExportOpen} onOpenChange={setImportExportOpen} />
      </div>
    </>
  );
}

/** Icon-only strip shown when the desktop rail is collapsed - just the expand trigger and the account avatar, everything else (title, scenario list, theme toggle) hides. */
function CollapsedSidebarContent({ onExpand }: { onExpand: () => void }) {
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onExpand}
        aria-label="Expand sidebar"
        className="size-9 cursor-pointer text-dim hover:text-ink"
      >
        <PanelLeftOpen className="size-4" />
      </Button>

      <div className="flex-1" />

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Account menu"
            className="rounded-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo/40"
          >
            <Avatar className="w-9 h-9">
              <AvatarFallback className="text-[12px] font-bold text-white" style={{ background: BRAND_GRADIENT }}>
                SL
              </AvatarFallback>
            </Avatar>
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="end"
          sideOffset={10}
          collisionPadding={12}
          className="w-auto min-w-[280px] flex flex-col items-center gap-5 px-10 py-8 bg-surface border-edge rounded-2xl shadow-[0_12px_40px_-8px_rgba(15,23,42,0.22)]"
        >
          <span className="max-w-full truncate text-[13px] font-medium text-ink-mid">{resumeData.personalInfo.email}</span>
          <Avatar className="w-24 h-24">
            <AvatarFallback className="text-3xl font-bold text-white" style={{ background: BRAND_GRADIENT }}>
              SL
            </AvatarFallback>
          </Avatar>
          <Button
            asChild
            variant="outline"
            className="rounded-full h-auto gap-2 px-[18px] py-2.5 text-[13px] font-semibold border-edge text-ink hover:bg-surface-pressed hover:text-ink"
          >
            <a href={PORTFOLIO_URL}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M9.5 3.5 5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Return to Portfolio
            </a>
          </Button>
          <button
            type="button"
            onClick={() => setAboutOpen(true)}
            className="flex items-center gap-1.5 text-[12.5px] font-medium text-dim hover:text-ink transition-colors cursor-pointer"
          >
            <Info className="size-3.5" />
            About this tool
          </button>
        </PopoverContent>
      </Popover>
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
    </>
  );
}

export function Sidebar({ open, onClose, activeLabel, collapsed, onToggleCollapsed }: SidebarProps) {
  // The Sheet only exists below lg; if the viewport crosses into lg while it's
  // open, close it so the portal-rendered overlay doesn't linger on desktop.
  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia('(min-width: 1024px)');
    if (mq.matches) {
      onClose();
      return;
    }
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) onClose();
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [open, onClose]);

  // A body-pointer-events-stuck safety net used to live here as a
  // Sidebar-specific effect. It's now a single app-wide watchdog
  // (useBodyPointerEventsWatchdog, wired in App.tsx) since the same class
  // of bug turned out to originate from other dialog/menu combinations
  // too, not just this drawer - and that version actually checks whether
  // something is legitimately still open before clearing the lock, which
  // this one didn't.

  return (
    <>
      {/* Static rail at lg+ - shrinks to an icon-only strip when collapsed, rather than disappearing entirely. */}
      <aside
        className={cn(
          'hidden lg:flex shrink-0 sticky top-0 h-dvh flex-col bg-surface border-r border-edge',
          collapsed ? 'w-16 items-center px-2 py-6' : 'w-[248px] px-4 py-6',
        )}
      >
        {collapsed ? (
          <CollapsedSidebarContent onExpand={onToggleCollapsed} />
        ) : (
          <SidebarContent onNavigate={onClose} activeLabel={activeLabel} onToggleCollapsed={onToggleCollapsed} />
        )}
      </aside>

      {/* Drawer below lg */}
      <Sheet open={open} onOpenChange={(isOpen: boolean) => { if (!isOpen) onClose(); }}>
        <SheetContent
          side="left"
          aria-describedby={undefined}
          className="w-[248px] flex flex-col gap-0 bg-surface border-edge px-4 py-6 lg:hidden"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent onNavigate={onClose} activeLabel={activeLabel} onToggleCollapsed={onToggleCollapsed} />
        </SheetContent>
      </Sheet>
    </>
  );
}
