import resumeData from '../../lib/resumeData';
import { Reveal } from './Reveal';

export function EducationSection() {
  const { education } = resumeData;

  return (
    <Reveal delay={0} className="mt-16">
      <section>
        <div className="flex items-center gap-3 mb-[22px]">
          <h2 className="font-mono m-0 text-section tracking-[0.14em] uppercase text-accent font-semibold">Education</h2>
          <span className="flex-1 h-px" style={{ background: 'linear-gradient(to right, var(--color-border-section-rule), transparent)' }} />
        </div>
        {education.map((edu) => (
          <div key={edu.institution} className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h3 className="m-0 mb-1 text-[17px] font-semibold text-ink-darkest">{edu.institution}</h3>
              <div className="text-body text-ink-secondary leading-[1.55]">{edu.degree}</div>
              <div className="text-card text-ink-mono mt-[2px]">Concentration: {edu.concentration}</div>
              <div className="text-card text-ink-mono mt-[2px]">{edu.location}</div>
            </div>
            {edu.period && <span className="font-mono text-date text-ink-faint whitespace-nowrap">{edu.period}</span>}
          </div>
        ))}
      </section>
    </Reveal>
  );
}
