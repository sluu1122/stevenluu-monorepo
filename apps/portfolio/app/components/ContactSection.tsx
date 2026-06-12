import resumeData from '../../lib/resumeData';
import { Reveal } from './Reveal';

export function ContactSection() {
  const { personalInfo } = resumeData;

  return (
    <Reveal delay={0} className="mt-22 pt-[34px] border-t border-border-divider text-center">
      <section>
        <h2 className="m-0 mb-2 text-contact-h2 font-semibold tracking-[-0.02em] text-ink-darkest">Let&apos;s build something solid.</h2>
        <p className="m-0 mb-[22px] text-subtext text-ink-tertiary">Open to senior frontend &amp; UI platform roles.</p>
        <a
          href={`mailto:${personalInfo.email}`}
          className="inline-flex items-center gap-[9px] px-[22px] py-3 rounded-xl bg-ink-darkest text-white text-meta font-medium shadow-contact transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-contact-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2.5" />
            <path d="M3.5 7.5l8.5 5.5 8.5-5.5" />
          </svg>
          {personalInfo.email}
        </a>
        <div className="font-mono mt-[30px] text-label text-ink-faintest tracking-[0.03em]">© {new Date().getFullYear()} Steven Luu</div>
      </section>
    </Reveal>
  );
}
