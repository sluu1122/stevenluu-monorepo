export function DashboardHeader() {
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <header
      className="sticky top-0 z-10 border-b border-edge h-[60px] flex items-center justify-between px-8"
      style={{ background: 'rgba(247,248,250,0.82)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
    >
      <div>
        <h1 className="m-0 text-[17px] font-bold tracking-[-0.02em] text-ink leading-none">Overview</h1>
        <p className="m-0 text-[11.5px] text-dim font-mono mt-0.5">{dateStr}</p>
      </div>

      <div className="flex items-center gap-[7px] px-3 py-1.5 rounded-full border border-gain-border bg-gain-bg">
        <span
          className="w-[7px] h-[7px] rounded-full bg-gain inline-block"
          style={{ animation: 'engine 2.2s ease-in-out infinite' }}
        />
        <span className="text-[11.5px] font-medium text-gain-dark font-mono tracking-[0.01em] whitespace-nowrap">
          Mock Market Engine: Active · Streaming via Web Memory
        </span>
      </div>
    </header>
  );
}
