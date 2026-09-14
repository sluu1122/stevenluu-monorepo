import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@repo/ui/components/button';
import { DashCard } from './DashCard';
import { AboutDialog } from './AboutDialog';

const DISMISSED_KEY = 'retirement-planner:welcome-dismissed';

/**
 * The one thing a first-time visitor is never told: what they are looking at.
 *
 * The app opens straight onto four fully-populated scenarios with real
 * institution names and six-figure balances, which reads as somebody's data
 * rather than as examples. The only explanation lived in AboutDialog, behind
 * two clicks in the account menu, so in practice nobody read it.
 *
 * Dismissal is per-browser and permanent - this is a greeting, not a notice,
 * and re-greeting someone who has already said they get it is worse than
 * never having greeted them.
 */
export function WelcomeBanner() {
  const [aboutOpen, setAboutOpen] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    // Private windows and blocked site data both throw here, and a greeting is
    // never worth breaking the app over - failing to "already dismissed" also
    // avoids showing it forever to someone who cannot persist the dismissal.
    try {
      return window.localStorage.getItem(DISMISSED_KEY) === '1';
    } catch {
      return true;
    }
  });

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Nothing to do - it stays dismissed for this session either way.
    }
  }

  if (dismissed) return null;

  return (
    <DashCard className="border-indigo/25 bg-indigo-bg py-3 mb-4 flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-ink mb-0.5">These four scenarios are examples, not your data.</p>
        <p className="text-[12.5px] text-slate leading-[1.45]">
          They're here so the app has something to show. Edit them, delete them, or add your own - nothing leaves your browser. Every figure in the
          Planning Grid can be opened to see how it was calculated.
        </p>
        <div className="flex items-center gap-1 mt-1.5 -ml-2">
          <Button variant="ghost" size="sm" className="cursor-pointer text-indigo hover:text-indigo" onClick={() => setAboutOpen(true)}>
            What is this?
          </Button>
          <Button variant="ghost" size="sm" className="cursor-pointer text-slate" onClick={dismiss}>
            Got it
          </Button>
        </div>
      </div>
      <Button type="button" variant="ghost" size="icon" className="size-6 cursor-pointer shrink-0 text-dim" onClick={dismiss} aria-label="Dismiss welcome message">
        <X className="size-3.5" />
      </Button>
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
    </DashCard>
  );
}
