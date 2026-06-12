import resumeData from '../../lib/resumeData';
import { Reveal } from './Reveal';

export function SkillsSection() {
  const { technicalSkills } = resumeData;

  return (
    <section className="mt-16">
      <Reveal delay={0} className="flex items-center gap-3 mb-[26px]">
        <h2 className="font-mono m-0 text-section tracking-[0.14em] uppercase text-accent font-semibold">Skills</h2>
        <span className="flex-1 h-px" style={{ background: 'linear-gradient(to right, var(--color-border-section-rule), transparent)' }} />
      </Reveal>

      <div className="flex flex-col gap-6">
        <Reveal delay={0}>
          <div>
            <div className="font-mono text-label tracking-[0.08em] uppercase text-ink-faint mb-3">Languages &amp; Frameworks</div>
            <div className="flex flex-wrap gap-2">
              {technicalSkills.languagesAndFrameworks.map((skill) => (
                <span key={skill} className="inline-flex px-[13px] py-[7px] rounded-pill border border-border-default bg-white text-pill text-pill-text shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-[transform,border-color,color] duration-[180ms] hover:-translate-y-0.5 hover:border-accent-light hover:text-accent">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={90}>
          <div>
            <div className="font-mono text-label tracking-[0.08em] uppercase text-ink-faint mb-3">Infrastructure &amp; Tools</div>
            <div className="flex flex-wrap gap-2">
              {technicalSkills.infrastructureAndTools.map((skill) => (
                <span key={skill} className="inline-flex px-[13px] py-[7px] rounded-pill border border-border-default bg-white text-pill text-pill-text shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-[transform,border-color,color] duration-[180ms] hover:-translate-y-0.5 hover:border-accent-light hover:text-accent">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={160}>
          <div>
            <div className="font-mono text-label tracking-[0.08em] uppercase text-ink-faint mb-3">AI-Assisted Development</div>
            <div className="flex flex-wrap gap-2">
              {technicalSkills.aiAssistedDevelopment.map((skill) => (
                <span key={skill} className="inline-flex items-center gap-[7px] px-[13px] py-[7px] rounded-pill border border-ai-border text-pill text-ai-text shadow-[0_1px_2px_rgba(91,91,214,0.05)] transition-[transform] duration-[180ms] hover:-translate-y-0.5" style={{ background: 'linear-gradient(180deg,#FBFBFF,#F4F4FE)' }}>
                  <span className="w-[6px] h-[6px] rounded-full bg-accent" />
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
