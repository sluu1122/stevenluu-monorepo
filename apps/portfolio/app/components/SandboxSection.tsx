import { Reveal } from './Reveal';

const sandboxes = [
  {
    href: process.env.NEXT_PUBLIC_ANGULAR_SANDBOX_URL || 'https://angular.stevenluu.com',
    monogram: 'Ng',
    monogramStyle: { background: 'linear-gradient(160deg,#FFF0F2,#FCE3E6)', border: '1px solid #F6D7DB', color: 'var(--color-angular-red)' },
    hoverClass: 'hover:border-angular-hover-border',
    title: 'Enterprise Angular Showcase',
    description: 'Large-scale architecture patterns for complex, data-dense enterprise applications.',
    tags: ['Zoneless Angular', 'NgRx SignalStore'],
    domain: 'angular.stevenluu.com',
    delay: 0,
  },
  {
    href: process.env.NEXT_PUBLIC_REACT_SANDBOX_URL || 'https://react.stevenluu.com',
    monogram: 'Re',
    monogramStyle: { background: 'linear-gradient(160deg,#EBF8FD,#DDF0F8)', border: '1px solid #CDE9F3', color: 'var(--color-react-blue)' },
    hoverClass: 'hover:border-react-hover-border',
    title: 'High-Performance React Showcase',
    description: 'Bleeding-edge React patterns tuned for speed, concurrency, and data fetching.',
    tags: ['React 19', 'Vite', 'TanStack Query'],
    domain: 'react.stevenluu.com',
    delay: 100,
  },
];

const ArrowIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 17L17 7M9 7h8v8" />
  </svg>
);

export function SandboxSection() {
  return (
    <section className="mt-21">
      <Reveal delay={0} className="text-center mb-[34px]">
        <span className="font-mono inline-flex items-center gap-[7px] px-3 py-[5px] rounded-full bg-accent-bg text-accent text-label tracking-[0.08em] uppercase font-semibold">Live Sandboxes</span>
        <h2 className="mt-4 mb-2 text-sandbox-h2 font-semibold tracking-[-0.03em] text-ink-darkest">Engineering Showcases</h2>
        <p className="m-0 mx-auto text-[16px] leading-[1.6] text-ink-tertiary max-w-[46ch]">Two production-grade playgrounds exploring opposite ends of the modern frontend spectrum.</p>
      </Reveal>

      <div className="grid grid-cols-2 gap-[18px]">
        {sandboxes.map((s) => (
          <Reveal key={s.href} delay={s.delay} className="flex flex-col">
            <a
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex flex-col p-6 rounded-card border border-border-default bg-white shadow-card flex-1 transition-[transform,box-shadow,border-color] duration-[250ms] hover:-translate-y-1 hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${s.hoverClass}`}
            >
              <div className="flex items-center justify-between">
                <div className="font-mono flex items-center justify-center w-[46px] h-[46px] rounded-monogram font-semibold text-[15px] tracking-[-0.02em]" style={s.monogramStyle}>{s.monogram}</div>
                <span className="inline-flex items-center justify-center w-[34px] h-[34px] rounded-full border border-border-arrow text-ink-faint">
                  <ArrowIcon />
                </span>
              </div>
              <h3 className="mt-[18px] mb-2 text-[17.5px] font-semibold tracking-[-0.01em] text-ink-darkest">{s.title}</h3>
              <p className="m-0 mb-[18px] text-card text-ink-tertiary flex-1">{s.description}</p>
              <div className="flex flex-wrap gap-[6px] mb-[14px]">
                {s.tags.map((tag) => (
                  <span key={tag} className="font-mono px-[9px] py-1 rounded-[7px] bg-tag-bg text-[11px] text-ink-company">{tag}</span>
                ))}
              </div>
              <div className="font-mono text-[12px] text-ink-faintest">{s.domain}</div>
            </a>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
