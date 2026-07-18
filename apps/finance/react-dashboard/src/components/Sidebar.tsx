import { useEffect } from 'react';
import { resumeData } from '@repo/resume-data';
import { Avatar, AvatarFallback } from '@repo/ui/components/avatar';
import { Button } from '@repo/ui/components/button';
import { Popover, PopoverContent, PopoverTrigger } from '@repo/ui/components/popover';
import { Sheet, SheetContent, SheetTitle } from '@repo/ui/components/sheet';
import { cn } from '../lib/utils';

const NAV_LINKS = [
  { label: 'Overview', active: true },
  { label: 'Sandbox Portfolio', active: false },
  { label: 'Transactions', active: false },
  { label: 'Market Stream', active: false },
];

const BRAND_GRADIENT = 'linear-gradient(135deg, #5B5BD6 0%, #6E6AF0 100%)';

// Mirrors the Angular dashboard's portfolioUrl default (localhost:3000 in dev,
// the live site in prod). No runtime env plumbing needed for a static build.
const PORTFOLIO_URL = import.meta.env.DEV ? 'http://localhost:3000' : 'https://stevenluu.com';

interface SidebarProps {
  /** Drawer visibility below lg; ignored at lg+ where the rail is always shown. */
  open: boolean;
  onClose: () => void;
}

function SidebarContent({ onNavigate }: { onNavigate: () => void }) {
  return (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-8 pl-1">
        <div
          className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center shrink-0"
          style={{ background: BRAND_GRADIENT }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <polyline points="1,13 5,8 9,10 13,4 17,6" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </div>
        <div>
          <p className="font-bold text-[14px] tracking-[-0.02em] text-ink leading-[1.2] m-0">Finance</p>
          <p className="font-mono text-[10px] text-dim tracking-[0.04em] leading-[1.3] m-0">SANDBOX</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5">
        {NAV_LINKS.map((link) => (
          <Button
            key={link.label}
            variant="ghost"
            onClick={onNavigate}
            className={cn(
              'w-full h-auto justify-start gap-2.5 px-3 py-[9px] rounded-[9px] text-[13.5px] tracking-[-0.01em]',
              link.active
                ? 'font-semibold text-indigo bg-indigo-bg hover:bg-indigo-bg hover:text-indigo'
                : 'font-normal text-slate hover:bg-surface-pressed hover:text-slate',
            )}
          >
            {link.label}
          </Button>
        ))}
      </nav>

      <div className="flex-1" />

      {/* Bottom */}
      <div className="border-t border-edge pt-4 flex flex-col gap-3">
        <p className="text-[11px] text-dim font-mono tracking-[0.03em] leading-[1.5] m-0">
          Mock data only — no real positions
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
                <p className="text-[11px] text-dim m-0">Portfolio Mode</p>
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
          </PopoverContent>
        </Popover>
      </div>
    </>
  );
}

export function Sidebar({ open, onClose }: SidebarProps) {
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

  // Safety net: while the drawer is open, Radix's modal layer locks the page by
  // setting `body { pointer-events: none }`, released on unmount. If a browser
  // quirk ever leaves that lock stuck after close, every tap on the app dies.
  // Once the drawer is closed, verify the lock was actually released and clear
  // it if not. With the synchronous-unmount fix in @repo/ui's SheetContent this
  // should never fire — it exists so this class of bug can never recur.
  useEffect(() => {
    if (open) return;
    const id = window.setTimeout(() => {
      if (document.body.style.pointerEvents === 'none') {
        document.body.style.pointerEvents = '';
      }
    }, 500);
    return () => window.clearTimeout(id);
  }, [open]);

  return (
    <>
      {/* Static rail at lg+ */}
      <aside className="hidden lg:flex w-[248px] shrink-0 sticky top-0 h-dvh flex-col bg-surface border-r border-edge px-4 py-6">
        <SidebarContent onNavigate={onClose} />
      </aside>

      {/* Drawer below lg */}
      <Sheet open={open} onOpenChange={(isOpen: boolean) => { if (!isOpen) onClose(); }}>
        <SheetContent
          side="left"
          aria-describedby={undefined}
          className="w-[248px] flex flex-col gap-0 bg-surface border-edge px-4 py-6 lg:hidden"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent onNavigate={onClose} />
        </SheetContent>
      </Sheet>
    </>
  );
}
