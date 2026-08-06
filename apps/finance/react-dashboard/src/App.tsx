import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@repo/ui/components/button';
import { Sidebar } from './components/Sidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/tabs';
import { ThemeProvider } from './providers/ThemeProvider';
import { ActiveScenarioProvider } from './providers/ActiveScenarioProvider';
import { SelectedPersonProvider } from './providers/SelectedPersonProvider';
import { DisplayCurrencyProvider } from './providers/DisplayCurrencyProvider';
import { ScenarioSetupTab } from './features/scenario-setup/ScenarioSetupTab';
import { PlanningGridTab } from './features/planning-grid/PlanningGridTab';
import { ChartsAnalyticsTab } from './features/charts-analytics/ChartsAnalyticsTab';
import { ClientSummaryTab } from './features/client-summary/ClientSummaryTab';
import { useActiveScenario } from './hooks/useActiveScenario';
import { useScenarios } from './hooks/useScenarios';
import { useBodyPointerEventsWatchdog } from './hooks/useBodyPointerEventsWatchdog';

const TABS = [
  { value: 'setup', label: 'Scenario Setup' },
  { value: 'grid', label: 'Planning Grid' },
  { value: 'charts', label: 'Charts & Analytics' },
  { value: 'summary', label: 'Client Summary' },
] as const;

type TabValue = (typeof TABS)[number]['value'];

const SIDEBAR_COLLAPSED_KEY = 'retirement-planner:sidebar-collapsed';

export default function App() {
  useBodyPointerEventsWatchdog();

  return (
    <ThemeProvider>
      <ActiveScenarioProvider>
        <SelectedPersonProvider>
          <DisplayCurrencyProvider>
            <AppShell />
          </DisplayCurrencyProvider>
        </SelectedPersonProvider>
      </ActiveScenarioProvider>
    </ThemeProvider>
  );
}

// Split out from App so it sits inside the providers and can read the active
// scenario - the tab bar's scroll memory needs to know when a save landed.
function AppShell() {
  const [navOpen, setNavOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabValue>('setup');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0');
  }, [sidebarCollapsed]);

  const { activeScenarioId } = useActiveScenario();
  const { data: scenarios = [] } = useScenarios();
  const activeScenario = scenarios.find((s) => s.id === activeScenarioId) ?? null;

  // Every tab shares the one scroll container in <main>, so without this,
  // leaving a tab loses your place in it. Park the outgoing tab's offset and
  // put it back on the way in, before paint.
  const mainRef = useRef<HTMLElement>(null);
  const scrollByTab = useRef<Partial<Record<TabValue, number>>>({});

  // ...except once a save (or a scenario switch) lands, every downstream number
  // is recomputed and the rows/cards a remembered offset pointed at have moved.
  // Drop the offsets so those tabs open at the top rather than mid-nowhere. The
  // tab you're standing on keeps its position - a save shouldn't yank you away
  // from what you just edited - and gets re-remembered on the way out.
  const scenarioRevision = `${activeScenarioId ?? ''}|${activeScenario?.updatedAt ?? ''}`;
  useEffect(() => {
    scrollByTab.current = {};
  }, [scenarioRevision]);

  function selectTab(next: TabValue) {
    if (mainRef.current) scrollByTab.current[activeTab] = mainRef.current.scrollTop;
    setActiveTab(next);
  }

  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const target = scrollByTab.current[activeTab] ?? 0;
    main.scrollTop = target;
    if (main.scrollTop === target) return;

    // Didn't take: the incoming tab is still laying out (charts measuring, cards
    // reflowing), so the container isn't tall enough to reach that offset yet.
    // Re-apply as it grows, and bail the moment it lands, the user takes over,
    // or the content turns out to be genuinely shorter than where we left off.
    let frame = requestAnimationFrame(function settle() {
      if (!mainRef.current) return;
      mainRef.current.scrollTop = target;
      if (mainRef.current.scrollTop !== target) frame = requestAnimationFrame(settle);
    });
    const stop = () => cancelAnimationFrame(frame);
    const deadline = window.setTimeout(stop, 1000);
    main.addEventListener('wheel', stop, { passive: true });
    main.addEventListener('touchstart', stop, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(deadline);
      main.removeEventListener('wheel', stop);
      main.removeEventListener('touchstart', stop);
    };
  }, [activeTab]);

  const activeLabel = TABS.find((t) => t.value === activeTab)?.label ?? '';

  return (
    <div className="flex h-dvh overflow-hidden print:h-auto print:overflow-visible">
      <div className="print:hidden contents">
        <Sidebar
          open={navOpen}
          onClose={() => setNavOpen(false)}
          activeLabel={activeLabel}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
        />
      </div>

      {/*
        `relative` here (not on <main>) is what makes the tab bar float: it's an
        absolutely-positioned sibling of the scrolling <main>, so it never moves
        as main scrolls beneath it, and never had a sticky-inside-a-clipped-flex-
        item bug to begin with (position: sticky's containing block was main's
        own flex-computed box, which content taller than one screen overflows
        past - so the old sticky bar stopped being "contained" partway down and
        vanished for the rest of the scroll).
      */}
      <Tabs
        value={activeTab}
        onValueChange={(v: string) => selectTab(v as TabValue)}
        className="relative flex-1 min-w-0 min-h-0 flex flex-col print:h-auto"
      >
        {/* Floating, centered pill - no backdrop, so it never hides content behind it except its own small footprint. */}
        <div className="pointer-events-none absolute inset-x-0 top-4 sm:top-[26px] z-30 flex justify-center px-14 print:hidden">
          {/*
            overflow-x-auto alone leaves overflow-y at its default 'visible', but a
            non-visible overflow-x forces the other axis to compute as 'auto' too -
            so the border above, which shrinks the content box by a couple pixels
            under border-box sizing, was enough to trip a vertical scrollbar into
            existence. overflow-y-hidden pins that axis so it can never appear.
          */}
          <TabsList className="pointer-events-auto shadow-md border border-edge justify-start overflow-x-auto overflow-y-hidden max-w-full">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="cursor-pointer">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Nav toggle floats independently so the centered pill above doesn't have to make room for it. */}
        <div className="absolute left-4 top-4 sm:left-6 sm:top-[26px] z-30 lg:hidden print:hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
            className="cursor-pointer w-9 h-9 rounded-[9px] text-ink bg-surface-raised shadow-md hover:bg-surface-pressed hover:text-ink"
          >
            <Menu className="size-[18px]" />
          </Button>
        </div>

        <main
          ref={mainRef}
          className="flex-1 min-h-0 pt-20 sm:pt-24 px-4 sm:px-6 lg:px-8 pb-10 flex flex-col overflow-y-auto overscroll-contain print:overflow-visible print:h-auto print:p-0"
        >
          {/*
            Setup stays mounted while you're on another tab, so coming back
            lands on the same person sub-tab with the same in-progress edits
            instead of resetting to Scenario. forceMount keeps the children
            alive but also drops Radix's own `hidden`, so the panel hides
            itself off the data-state Radix still sets.
          */}
          <TabsContent value="setup" forceMount className="max-w-[1240px] w-full mx-auto data-[state=inactive]:hidden">
            <ScenarioSetupTab />
          </TabsContent>
          <TabsContent value="grid" className="flex-1 min-h-0 flex flex-col">
            <PlanningGridTab />
          </TabsContent>
          <TabsContent value="charts" className="max-w-[1240px] w-full mx-auto">
            <ChartsAnalyticsTab />
          </TabsContent>
          <TabsContent value="summary" className="max-w-[1240px] w-full mx-auto print:max-w-none">
            <ClientSummaryTab />
          </TabsContent>
        </main>
      </Tabs>
    </div>
  );
}
