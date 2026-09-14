import { AlertTriangle } from 'lucide-react';
import { DashCard } from './DashCard';

interface ScenarioErrorBannerProps {
  /**
   * The plain `{ message, stack }` the ledger hook captures, not an Error
   * instance - it flattens the throw so the failure travels with the result
   * (see `useScenarioLedgers`).
   */
  error: { message: string; stack?: string };
}

/**
 * Shown wherever a tab renders engine output.
 *
 * Every output tab needs this, not just the grid: a throw leaves `rows` empty,
 * and an empty ledger is indistinguishable from a real one worth nothing. The
 * charts draw blank axes and the summary reports $0 - both of which read as an
 * answer rather than a failure, and the $0 reads as a catastrophic one.
 *
 * The message leads with the fix rather than the stack, since the cause is
 * almost always a reference to an account that has since been deleted.
 */
export function ScenarioErrorBanner({ error }: ScenarioErrorBannerProps) {
  return (
    <DashCard className="border-loss/30 bg-loss-bg flex items-start gap-2.5 py-3">
      <AlertTriangle className="size-4 text-loss shrink-0 mt-0.5" />
      <div className="text-[12.5px] text-loss-dark w-full">
        <p className="font-semibold mb-1">This scenario failed to calculate.</p>
        <p className="mb-1.5">
          No figures on this tab are usable until it's fixed. The usual cause is a setting still pointing at an account that has been deleted - check the
          withdrawal order, the cash buffer's replenishment order, and any grid overrides in Scenario Setup.
        </p>
        <details>
          <summary className="cursor-pointer font-medium">Show details</summary>
          <pre className="mt-1.5 whitespace-pre-wrap break-words text-[11.5px] bg-surface border border-loss/20 rounded-md p-2">
            {error.message}
            {error.stack ? `\n\n${error.stack}` : ''}
          </pre>
        </details>
      </div>
    </DashCard>
  );
}
