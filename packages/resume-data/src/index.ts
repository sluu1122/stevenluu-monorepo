export interface PersonalInfo {
  name: string;
  location: string;
  phone: string;
  email: string;
  linkedin: string;
}

export interface TechnicalSkills {
  languagesAndFrameworks: string[];
  infrastructureAndTools: string[];
  aiAssistedDevelopment: string[];
}

export interface ProjectHighlight {
  title: string;
  description: string;
}

export interface WorkExperience {
  title: string;
  company: string;
  location: string;
  period: string;
  startYear: number;
  endYear: number | "present";
  coreStack: string[];
  highlights: ProjectHighlight[];
}

export interface Education {
  institution: string;
  location: string;
  degree: string;
  concentration: string;
}

export interface ResumeData {
  personalInfo: PersonalInfo;
  summary: string;
  technicalSkills: TechnicalSkills;
  experience: WorkExperience[];
  education: Education[];
}

export const resumeData: ResumeData = {
  personalInfo: {
    name: "Steven Luu",
    location: "Toronto, ON, Canada",
    phone: "(647) 568-4838",
    email: "sluu123@gmail.com",
    linkedin: "linkedin.com/in/stevenluudeveloper",
  },

  summary:
    "Frontend-focused Software Engineer with 19 years of experience building responsive, scalable web applications. Expert in UI development, modernizing legacy systems, and mentoring engineering teams. Proven track record of leading frontend architecture and delivering high-quality, scalable applications.",

  technicalSkills: {
    languagesAndFrameworks: [
      "Angular",
      "React",
      "TypeScript",
      "JavaScript",
      "TailwindCSS",
      "Vite",
      "NgRx/Redux",
      "PrimeNg",
      "shadcn/ui",
      "HTML",
      "CSS/SCSS",
      "Node.js",
      "C#",
      "VB.NET",
    ],
    infrastructureAndTools: [
      "Mobile-First/Responsive Design",
      "Figma",
      "Monorepo/Turborepo",
      "Docker",
      "Capacitor",
      "Jest",
      "Jasmine",
      "Vitest",
      "SQL Server",
      "MySQL",
      "Oracle",
    ],
    aiAssistedDevelopment: ["Copilot", "Claude Code"],
  },

  experience: [
    {
      title: "Senior Software Engineer",
      company: "R1 RCM (formerly SCI Solutions)",
      location: "Tucson, AZ (Remote)",
      period: "2009 – 2025",
      startYear: 2009,
      endYear: 2025,
      coreStack: [
        "Angular",
        "TypeScript",
        "NgRx",
        "PrimeNg",
        "Jest",
        "Jasmine",
        "SCSS",
        "C#",
        "VB.NET",
        "SQL Server",
      ],
      highlights: [
        {
          title: "Provider Experience Application",
          description:
            "Led UI development and state management architecture for a platform connecting providers and hospitals for patient care and referral management. Championed AI-assisted development with Copilot to accelerate feature delivery.",
        },
        {
          title: "R1 Registrar Dashboard",
          description:
            "Designed and implemented a patient intake and scheduling management dashboard with mobile-first, responsive design. Established a comprehensive unit testing suite and developed reusable UI components adopted as enterprise-wide standards.",
        },
        {
          title: "Order Facilitator",
          description:
            "Primary UI developer for a high-traffic, EMR-integrated referral and outpatient order management platform. Led major modernization efforts for this 20-year-old application, migrating legacy systems to modern architectures while maintaining database integrity and legacy support.",
        },
        {
          title: "R1 Entri",
          description:
            "Developed a patient self-scheduling platform for healthcare providers. Implemented complex rules-based booking and insurance verification logic to streamline the appointment process.",
        },
        {
          title: "Leadership",
          description:
            "Onboarded and mentored junior developers, focusing on frontend best practices and modernization methodologies.",
        },
      ],
    },
    {
      title: "Software Engineer",
      company: "Raytheon Information Solutions",
      location: "Pasadena, CA",
      period: "2006 – 2009",
      startYear: 2006,
      endYear: 2009,
      coreStack: ["Java", "JSP", "JavaScript", "MySQL", "CSS", "HTML", "ColdFusion"],
      highlights: [
        {
          title: "Raytheon Pasadena Portal",
          description:
            "Led development of an internal financial insight portal, providing real-time data visualization and reporting for project leads.",
        },
        {
          title: "JPL Langley Integrated Financial Environment (LIFE)",
          description:
            "Developed and maintained a comprehensive financial data management environment supporting the NASA Langley Research Center.",
        },
        {
          title: "WISDM Project",
          description:
            "Engineered a personnel management module for the Weapon Information System and Data Management project using Java and JSP.",
        },
        {
          title: "CMS Support",
          description:
            "Enhanced and supported NASA and JPL content management systems, delivering custom modules to provide dynamic web experiences for researchers and administrators.",
        },
      ],
    },
  ],

  education: [
    {
      institution: "California State Polytechnic University, Pomona",
      location: "Pomona, CA",
      degree: "Bachelor of Science in Business Administration",
      concentration: "Computer Information Systems – Application Development",
    },
  ],
};

export default resumeData;
