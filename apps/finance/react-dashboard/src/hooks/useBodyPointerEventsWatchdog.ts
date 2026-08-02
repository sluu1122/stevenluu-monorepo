import { useEffect } from 'react';

/**
 * Safety net for a confirmed Radix composition bug: opening a Dialog
 * directly from a DropdownMenuItem's onSelect (same tick as the menu
 * closing) can leave document.body.style.pointerEvents stuck at "none"
 * forever, killing every click on the page - reproduced even with a plain
 * Escape-close and no async logic involved. Root-causing the exact layer
 * race between the two Radix primitives (and a follow-up attempt to defer
 * the dialog's open state, which fixed the lock but broke Escape-to-close
 * by decoupling focus handoff) cost more than this is worth to chase
 * further, so this watches for the lock and clears it if nothing is
 * actually supposed to be open - the same "detect and release" approach
 * already used for the Sidebar's mobile drawer, generalized to the whole
 * app since this can now originate from any dialog/menu combination.
 */
export function useBodyPointerEventsWatchdog() {
  useEffect(() => {
    const observer = new MutationObserver(() => {
      if (document.body.style.pointerEvents !== 'none') return;

      window.setTimeout(() => {
        if (document.body.style.pointerEvents !== 'none') return;
        const anyOpenLayer = document.querySelector('[data-state="open"][role="dialog"], [data-state="open"][role="menu"], [data-state="open"][role="alertdialog"]');
        if (!anyOpenLayer) {
          document.body.style.pointerEvents = '';
        }
      }, 400);
    });

    observer.observe(document.body, { attributes: true, attributeFilter: ['style'] });
    return () => observer.disconnect();
  }, []);
}
