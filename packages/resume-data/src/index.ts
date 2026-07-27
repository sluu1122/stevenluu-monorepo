export interface ProjectGateway {
  name: string;
  subdomain: string;
  stackTags: string[];
}

export interface PersonalInfo {
  name: string;
  location: string;
  phone: string;
  email: string;
  linkedin: string;
  github: string;
}

export interface TechnicalSkills {
  frontendAndUi: string[];
  backendAndDatabases: string[];
  testing: string[];
  toolingAndBuild: string[];
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
  period?: string;
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
    github: "github.com/sluu1122",
  },

  summary:
    "Software Engineer with 19 years of experience building responsive, scalable web applications. Expert in UI development, modernizing legacy systems, and mentoring engineering teams. Proven track record of leading frontend architecture and delivering high-quality, scalable applications.",

  technicalSkills: {
    frontendAndUi: [
      "Angular",
      "React",
      "TypeScript",
      "JavaScript",
      "NgRx/Redux",
      "TailwindCSS",
      "PrimeNG",
      "shadcn/ui",
      "HTML",
      "CSS/SCSS",
      "Responsive Design",
    ],
    backendAndDatabases: [
      "Node.js",
      "C#",
      "VB.NET",
      "Java",
      "SQL Server",
      "MySQL",
      "Oracle",
    ],
    testing: ["Jest", "Jasmine", "Vitest"],
    toolingAndBuild: [
      "Vite",
      "Turborepo",
      "Docker",
      "CI/CD (GitHub Actions)",
      "Figma",
    ],
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
            "Built a platform that gives hospital staff a single place to manage physician orders, optimize scheduling, and handle insurance verification and prior authorizations, cutting claim denials.",
        },
        {
          title: "R1 Registrar Dashboard",
          description:
            "Built a registration dashboard that gives hospital front-desk staff and patient access representatives a single place to search patient visits, monitor the real-time patient queue, and track patients through intake from pre-registration to check-in.",
        },
        {
          title: "Order Facilitator",
          description:
            "Primary UI developer for a web-based platform connecting physician offices with hospitals, letting them submit orders, capture e-signatures, and track status in real time. Continuously modernized the 20-year-old application, incrementally replacing legacy systems.",
        },
        {
          title: "Entri Self-Scheduling",
          description:
            "Developer for a patient-facing scheduling app that let patients book, reschedule, and cancel appointments online.",
        },
        {
          title: "Leadership",
          description:
            "Onboarded and mentored junior developers on frontend best practices, guiding them through code reviews, component patterns, and day-to-day problem-solving.",
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
            "Led development of an internal financial portal that gave project leads real-time reporting and data visualization.",
        },
        {
          title: "JPL Langley Integrated Financial Environment (LIFE)",
          description:
            "Built and maintained the financial data management environment used by NASA's Langley Research Center.",
        },
        {
          title: "WISDM Project",
          description:
            "Built the personnel management module for the Weapon Information System and Data Management project for the US Navy.",
        },
        {
          title: "CMS Support",
          description:
            "Maintained and extended NASA and JPL content management systems, building custom modules for researchers and administrators.",
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
