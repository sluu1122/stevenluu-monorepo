/**
 * Puts a scroll container back to a remembered offset, re-applying it until
 * it takes.
 *
 * One assignment usually isn't enough. The content being scrolled is often
 * still laying out when this runs (charts measuring, cards reflowing, a wide
 * grid settling its column widths), so the container isn't yet big enough to
 * reach the offset and the browser clamps the write to whatever currently
 * fits. Re-applying each frame lands it as the content grows, and stops the
 * moment it takes, the user scrolls themselves, or the deadline passes -
 * which is what covers the case where the content is genuinely smaller than
 * where we left off and the offset is simply unreachable.
 *
 * Returns a cleanup that cancels any pending work; call it from the teardown
 * of whatever effect started the restore.
 */
export function restoreScrollPosition(el: HTMLElement, target: { top?: number; left?: number }, timeoutMs = 1000): () => void {
  const top = target.top ?? 0;
  const left = target.left ?? 0;

  const apply = () => {
    el.scrollTop = top;
    el.scrollLeft = left;
  };
  const landed = () => el.scrollTop === top && el.scrollLeft === left;

  apply();
  if (landed()) return () => {};

  let frame = requestAnimationFrame(function settle() {
    apply();
    if (!landed()) frame = requestAnimationFrame(settle);
  });
  const stop = () => cancelAnimationFrame(frame);
  const deadline = window.setTimeout(stop, timeoutMs);
  el.addEventListener('wheel', stop, { passive: true });
  el.addEventListener('touchstart', stop, { passive: true });

  return () => {
    cancelAnimationFrame(frame);
    window.clearTimeout(deadline);
    el.removeEventListener('wheel', stop);
    el.removeEventListener('touchstart', stop);
  };
}
