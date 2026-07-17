import { useEffect } from 'react';
import { resumeData } from '@repo/resume-data';
import { Avatar, AvatarFallback } from '@repo/ui/components/avatar';
import { Button } from '@repo/ui/components/button';
import { Sheet, SheetContent, SheetTitle } from '@repo/ui/components/sheet';
import { cn } from '../lib/utils';

const NAV_LINKS = [
  { label: 'Overview', active: true },
  { label: 'Sandbox Portfolio', active: false },
  { label: 'Transactions', active: false },
  { label: 'Market Stream', active: false },
];

const BRAND_GRADIENT = 'linear-gradient(135deg, #5B5BD6 0%, #6E6AF0 100%)';

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
        <div className="flex items-center gap-[9px]">
          <Avatar className="w-[30px] h-[30px]">
            <AvatarFallback
              className="text-[12px] font-bold text-white"
              style={{ background: BRAND_GRADIENT }}
            >
              SL
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-[13px] font-semibold text-ink tracking-[-0.01em] m-0">{resumeData.personalInfo.name}</p>
            <p className="text-[11px] text-dim m-0">Portfolio Mode</p>
          </div>
        </div>
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
