'use client';

import { useRef, useEffect, type ReactNode, type CSSProperties } from 'react';

interface RevealProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  style?: CSSProperties;
}

export function Reveal({ children, delay = 0, className, style }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const hardReveal = () => {
      el.style.setProperty('opacity', '1', 'important');
      el.style.setProperty('transform', 'none', 'important');
      el.style.setProperty('filter', 'none', 'important');
      el.style.setProperty('transition', 'none', 'important');
    };

    const doReveal = () => {
      if (prefersReduced || typeof el.animate !== 'function') {
        hardReveal();
        return;
      }
      el.animate(
        [
          { opacity: 0, transform: 'translateY(14px)', filter: 'blur(8px)' },
          { opacity: 1, transform: 'none', filter: 'none' },
        ],
        { duration: 680, delay, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' }
      );
    };

    if (!('IntersectionObserver' in window)) {
      doReveal();
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          doReveal();
          io.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -6% 0px' }
    );
    io.observe(el);

    // If the animation clock is frozen (offscreen / headless), hard-reveal after timeout
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;left:-9px;top:-9px;width:1px;height:1px;opacity:0;pointer-events:none';
    document.body.appendChild(probe);
    const pa = probe.animate ? probe.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, fill: 'forwards' }) : null;
    let probeRemoved = false;
    const removeProbe = () => { if (!probeRemoved) { probe.remove(); probeRemoved = true; } };
    const timer = setTimeout(() => {
      const frozen = !pa || pa.currentTime == null || pa.currentTime === 0;
      removeProbe();
      if (frozen) hardReveal();
    }, 360);

    return () => {
      io.disconnect();
      clearTimeout(timer);
      removeProbe();
    };
  }, [delay]);

  return (
    <div
      ref={ref}
      className={`reveal-hidden${className ? ` ${className}` : ''}`}
      style={{ opacity: 0, transform: 'translateY(14px)', filter: 'blur(8px)', ...style }}
    >
      {children}
    </div>
  );
}
