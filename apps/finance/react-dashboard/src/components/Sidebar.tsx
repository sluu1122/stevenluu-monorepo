import { useEffect } from 'react';
import { resumeData } from '@repo/resume-data';

const NAV_LINKS = [
  { label: 'Overview', active: true },
  { label: 'Sandbox Portfolio', active: false },
  { label: 'Transactions', active: false },
  { label: 'Market Stream', active: false },
];

interface SidebarProps {
  /** Drawer visibility below lg; ignored at lg+ where the rail is always shown. */
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/35 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 h-dvh w-[248px] flex flex-col bg-surface border-r border-edge px-4 py-6 transition-transform duration-200 lg:sticky lg:top-0 lg:shrink-0 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8 pl-1">
          <div
            className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #5B5BD6 0%, #6E6AF0 100%)' }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <polyline points="1,13 5,8 9,10 13,4 17,6" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-[14px] tracking-[-0.02em] text-ink leading-[1.2] m-0">Finance</p>
            <p className="font-mono text-[10px] text-dim tracking-[0.04em] leading-[1.3] m-0">SANDBOX</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="ml-auto lg:hidden flex items-center justify-center w-8 h-8 rounded-[9px] border-none bg-transparent text-slate cursor-pointer transition-colors hover:bg-surface-pressed"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5">
          {NAV_LINKS.map((link) => (
            <button
              key={link.label}
              type="button"
              onClick={onClose}
              className={`flex items-center gap-2.5 px-3 py-[9px] rounded-[9px] text-[13.5px] tracking-[-0.01em] transition-colors text-left w-full border-none cursor-pointer ${
                link.active
                  ? 'font-semibold text-indigo bg-indigo-bg'
                  : 'font-normal text-slate bg-transparent'
              }`}
            >
              {link.label}
            </button>
          ))}
        </nav>

        <div className="flex-1" />

        {/* Bottom */}
        <div className="border-t border-edge pt-4 flex flex-col gap-3">
          <p className="text-[11px] text-dim font-mono tracking-[0.03em] leading-[1.5] m-0">
            Mock data only — no real positions
          </p>
          <div className="flex items-center gap-[9px]">
            <div
              className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[12px] font-bold text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, #5B5BD6 0%, #6E6AF0 100%)' }}
            >
              SL
            </div>
            <div>
              <p className="text-[13px] font-semibold text-ink tracking-[-0.01em] m-0">{resumeData.personalInfo.name}</p>
              <p className="text-[11px] text-dim m-0">Portfolio Mode</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
