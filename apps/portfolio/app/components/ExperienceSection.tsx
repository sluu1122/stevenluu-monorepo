import resumeData from '../../lib/resumeData';
import { Reveal } from './Reveal';

function CompanyName({ company }: { company: string }) {
  const idx = company.indexOf(' (formerly ');
  if (idx === -1) return <>{company}</>;
  return (
    <>
      {company.slice(0, idx)}
      <span className="text-ink-faintest">{company.slice(idx)}</span>
    </>
  );
}

export function ExperienceSection() {
  const { experience } = resumeData;

  return (
    <section className="mt-18">
      <Reveal delay={0} className="flex items-center gap-3 mb-[26px]">
        <h2 className="font-mono m-0 text-section tracking-[0.14em] uppercase text-accent font-semibold">Experience</h2>
        <span className="flex-1 h-px" style={{ background: 'linear-gradient(to right, var(--color-border-section-rule), transparent)' }} />
      </Reveal>

      <div className="relative pl-[30px]">
        <span className="absolute left-[5px] top-[6px] bottom-2 w-[1.5px]" style={{ background: 'linear-gradient(to bottom, var(--color-border-timeline), var(--color-border-timeline) 88%, transparent)' }} />

        {experience.map((job, i) => (
          <Reveal key={`${job.company}-${job.startYear}`} delay={i * 80} className={`relative ${i < experience.length - 1 ? 'pb-[38px]' : ''}`}>
            <article>
              <span
                className="absolute left-[-30px] top-[5px] w-[13px] h-[13px] rounded-full bg-white shadow-[0_0_0_4px_var(--color-page-bg)]"
                style={{ border: `2.5px solid ${job.endYear === 'present' ? 'var(--color-accent)' : 'var(--color-dot-inactive)'}` }}
              />
              <div className="flex items-baseline justify-between gap-4 flex-wrap">
                <h3 className="m-0 text-[18px] font-semibold tracking-[-0.01em] text-ink-darkest">{job.title}</h3>
                <span className="font-mono text-date text-ink-faint whitespace-nowrap">{job.period}</span>
              </div>
              <div className="mt-[3px] text-meta text-ink-company" style={{ fontWeight: 450 }}>
                <CompanyName company={job.company} /> · {job.location}
              </div>
              <div className="font-mono mt-3 mb-4 text-mono-sm text-ink-mono">
                {job.coreStack.join(' · ')}
              </div>
              <ul className="m-0 p-0 list-none flex flex-col gap-[13px]">
                {job.highlights.map((h) => (
                  <li key={h.title} className="relative pl-[18px] text-body text-ink-secondary">
                    <span className="absolute left-0 top-[9px] w-[5px] h-[5px] rounded-full bg-dot-bullet" />
                    <strong className="text-ink-bold font-semibold">{h.title}:</strong> {h.description}
                  </li>
                ))}
              </ul>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
