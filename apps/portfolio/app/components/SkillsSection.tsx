import resumeData from '../../lib/resumeData';
import { Reveal } from './Reveal';

export function SkillsSection() {
  const { technicalSkills } = resumeData;

  const skillGroups = [
    { label: 'Frontend & UI', skills: technicalSkills.frontendAndUi },
    { label: 'Backend & Databases', skills: technicalSkills.backendAndDatabases },
    { label: 'Testing', skills: technicalSkills.testing },
    { label: 'Tooling & Build', skills: technicalSkills.toolingAndBuild },
  ];

  return (
    <section className="mt-16">
      <Reveal delay={0} className="flex items-center gap-3 mb-[26px]">
        <h2 className="font-mono m-0 text-section tracking-[0.14em] uppercase text-accent font-semibold">Skills</h2>
        <span className="flex-1 h-px" style={{ background: 'linear-gradient(to right, var(--color-border-section-rule), transparent)' }} />
      </Reveal>

      <div className="flex flex-col gap-6">
        {skillGroups.map((group, i) => (
          <Reveal key={group.label} delay={i * 80}>
            <div>
              <div className="font-mono text-label tracking-[0.08em] uppercase text-ink-faint mb-3">{group.label}</div>
              <div className="flex flex-wrap gap-2">
                {group.skills.map((skill) => (
                  <span key={skill} className="inline-flex px-[13px] py-[7px] rounded-pill border border-border-default bg-white text-pill text-pill-text shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-[transform,border-color,color] duration-[180ms] hover:-translate-y-0.5 hover:border-accent-light hover:text-accent">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
