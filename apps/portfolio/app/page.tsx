import { ProfileSection } from './components/ProfileSection';
import { AboutSection } from './components/AboutSection';
import { ExperienceSection } from './components/ExperienceSection';
import { EducationSection } from './components/EducationSection';
import { SkillsSection } from './components/SkillsSection';
import { SandboxSection } from './components/SandboxSection';
import { ContactSection } from './components/ContactSection';

export default function Home() {
  return (
    <div className="relative min-h-screen bg-page-bg overflow-hidden">
      <div className="dot-grid" />
      <div className="top-glow" />
      <main className="relative z-10 max-w-[720px] mx-auto px-7 pt-24 pb-18">
        <ProfileSection />
        <AboutSection />
        <ExperienceSection />
        <EducationSection />
        <SkillsSection />
        <SandboxSection />
        <ContactSection />
      </main>
    </div>
  );
}
