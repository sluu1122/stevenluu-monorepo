import resumeData from "@repo/resume-data";

export default function Home() {
  const { personalInfo, summary } = resumeData;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold tracking-tight">{personalInfo.name}</h1>
      <p className="mt-2 text-lg text-gray-400">{personalInfo.location}</p>
      <p className="mt-6 max-w-2xl text-center text-gray-300 leading-relaxed">
        {summary}
      </p>
    </main>
  );
}
