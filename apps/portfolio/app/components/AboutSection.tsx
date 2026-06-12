import resumeData from '../../lib/resumeData';
import { Reveal } from './Reveal';

export function AboutSection() {
  const { summary } = resumeData;

  return (
    <Reveal delay={0} className="mt-18">
      <section>
        <div className="flex items-center gap-3 mb-[18px]">
          <h2 className="font-mono m-0 text-section tracking-[0.14em] uppercase text-accent font-semibold">About</h2>
          <span className="flex-1 h-px" style={{ background: 'linear-gradient(to right, var(--color-border-section-rule), transparent)' }} />
        </div>
        <p className="m-0 text-prose text-ink-prose max-w-[62ch]">
          {summary}
        </p>
      </section>
    </Reveal>
  );
}
