import { Sidebar } from './components/Sidebar';
import { DashboardHeader } from './components/DashboardHeader';
import { NetWorthCard } from './components/NetWorthCard';
import { WatchlistCard } from './components/WatchlistCard';
import { AllocationCard } from './components/AllocationCard';
import { TradeSandboxCard } from './components/TradeSandboxCard';

export default function App() {
  return (
    <div className="flex min-h-dvh">
      <Sidebar />

      <div className="flex-1 min-w-0 flex flex-col">
        <DashboardHeader />

        <main className="flex-1 pt-[26px] px-8 pb-10 max-w-[1240px] w-full">
          <div className="grid grid-cols-[minmax(0,1.58fr)_minmax(0,1fr)] gap-5 items-start">
            <div className="flex flex-col gap-5 min-w-0">
              <NetWorthCard />
              <WatchlistCard />
            </div>
            <div className="flex flex-col gap-5 min-w-0">
              <AllocationCard />
              <TradeSandboxCard />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
