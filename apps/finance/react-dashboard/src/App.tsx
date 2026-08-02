import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { DashboardHeader } from './components/DashboardHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/tabs';
import { ThemeProvider } from './providers/ThemeProvider';
import { ActiveScenarioProvider } from './providers/ActiveScenarioProvider';
import { ScenarioSetupTab } from './features/scenario-setup/ScenarioSetupTab';
import { PlanningGridTab } from './features/planning-grid/PlanningGridTab';
import { ChartsAnalyticsTab } from './features/charts-analytics/ChartsAnalyticsTab';
import { ClientSummaryTab } from './features/client-summary/ClientSummaryTab';
import { useBodyPointerEventsWatchdog } from './hooks/useBodyPointerEventsWatchdog';

const TABS = [
  { value: 'setup', label: 'Scenario Setup' },
  { value: 'grid', label: 'Planning Grid' },
  { value: 'charts', label: 'Charts & Analytics' },
  { value: 'summary', label: 'Client Summary' },
] as const;

type TabValue = (typeof TABS)[number]['value'];

export default function App() {
  useBodyPointerEventsWatchdog();
  const [navOpen, setNavOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabValue>('setup');

  const activeLabel = TABS.find((t) => t.value === activeTab)?.label ?? '';

  return (
    <ThemeProvider>
      <ActiveScenarioProvider>
        <div className="flex min-h-dvh">
          <div className="print:hidden contents">
            <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
          </div>

          <div className="flex-1 min-w-0 flex flex-col">
            <div className="print:hidden contents">
              <DashboardHeader title={activeLabel} onMenuClick={() => setNavOpen(true)} />
            </div>

            <main className="flex-1 pt-4 sm:pt-[26px] px-4 sm:px-6 lg:px-8 pb-10 max-w-[1240px] w-full print:p-0 print:max-w-none">
              <Tabs value={activeTab} onValueChange={(v: string) => setActiveTab(v as TabValue)}>
                <TabsList className="mb-5 print:hidden w-full sm:w-auto justify-start overflow-x-auto">
                  {TABS.map((tab) => (
                    <TabsTrigger key={tab.value} value={tab.value}>
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="setup">
                  <ScenarioSetupTab />
                </TabsContent>
                <TabsContent value="grid">
                  <PlanningGridTab />
                </TabsContent>
                <TabsContent value="charts">
                  <ChartsAnalyticsTab />
                </TabsContent>
                <TabsContent value="summary">
                  <ClientSummaryTab />
                </TabsContent>
              </Tabs>
            </main>
          </div>
        </div>
      </ActiveScenarioProvider>
    </ThemeProvider>
  );
}
