import resumeData from '../../lib/resumeData';
import { Reveal } from './Reveal';

export function ProfileSection() {
  const { personalInfo } = resumeData;

  return (
    <section className="flex flex-col-reverse items-start gap-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="flex-1 min-w-0">
        <Reveal delay={0}>
          <div>
            <div className="font-mono inline-flex items-center gap-2 px-[11px] py-[5px] border border-border-default bg-white/70 rounded-full text-label tracking-[0.04em] text-ink-company mb-[22px]">
              <span className="w-[7px] h-[7px] rounded-full bg-status-green shadow-[0_0_0_3px_rgba(22,163,74,0.14)]" />
              AVAILABLE FOR WORK
            </div>
            <h1 className="mb-[14px] text-profile tracking-[-0.035em] font-semibold text-ink-darkest whitespace-nowrap">
              {personalInfo.name}
            </h1>
            <p className="mb-6 text-tagline text-ink-secondary max-w-[30ch]">
              Frontend Software Engineer turning sprawling legacy systems into robust, modern UI platforms.
            </p>
          </div>
        </Reveal>

        <Reveal delay={120} className="flex items-center gap-[10px]">
          <a href={`mailto:${personalInfo.email}`} aria-label="Email" className="inline-flex items-center justify-center w-10 h-10 rounded-social border border-border-default bg-white text-pill-text shadow-social transition-[transform,border-color,color] duration-200 hover:-translate-y-0.5 hover:border-accent-light hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2.5" />
              <path d="M3.5 7.5l8.5 5.5 8.5-5.5" />
            </svg>
          </a>
          <a href={`https://${personalInfo.linkedin}`} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="font-mono inline-flex items-center justify-center w-10 h-10 rounded-social border border-border-default bg-white text-pill-text shadow-social text-[14px] font-semibold transition-[transform,border-color,color] duration-200 hover:-translate-y-0.5 hover:border-accent-light hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            in
          </a>
          <a href={`https://${personalInfo.github}`} target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="inline-flex items-center justify-center w-10 h-10 rounded-social border border-border-default bg-white text-pill-text shadow-social transition-[transform,border-color,color] duration-200 hover:-translate-y-0.5 hover:border-accent-light hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
          </a>
          <span className="inline-flex items-center gap-[7px] ml-[6px] text-[13.5px] text-ink-faint">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 21s-6.5-5.2-6.5-10.2A6.5 6.5 0 0 1 12 4.3a6.5 6.5 0 0 1 6.5 6.5C18.5 15.8 12 21 12 21z" />
              <circle cx="12" cy="10.6" r="2.1" />
            </svg>
            Toronto, ON
          </span>
        </Reveal>
      </div>

      <Reveal delay={60} className="shrink-0">
        <div className="relative w-[92px] h-[92px] sm:w-[118px] sm:h-[118px] rounded-full p-1 shadow-[0_12px_30px_-10px_rgba(15,23,42,0.18)]" style={{ background: 'conic-gradient(from 220deg, #EDEFFF, #F4F1FF, #E9F7FF, #EDEFFF)' }}>
          <div className="w-full h-full rounded-full flex items-center justify-center border border-white/80" style={{ background: 'linear-gradient(160deg, #F8FAFF, #EFF1F8)' }}>
            <span className="font-mono text-[24px] sm:text-[30px] font-semibold tracking-[0.02em] text-accent">SL</span>
          </div>
          <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-status-green" style={{ border: '3px solid var(--color-page-bg)' }} />
        </div>
      </Reveal>
    </section>
  );
}
