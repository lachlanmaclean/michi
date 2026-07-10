import { AppStateProvider, useAppState } from '@/state/AppStateContext';
import { GridConfigPanel } from '@/components/GridConfigPanel';
import { PageTabs } from '@/components/PageTabs';
import { BinderPageView } from '@/components/BinderPageView';
import { ExportPanel } from '@/components/ExportPanel';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LayoutGrid } from 'lucide-react';

function AppShell() {
  const { state, storageWarning } = useAppState();
  const activePage = state.binder.pages.find((p) => p.id === state.activePageId)!;

  return (
    <div className="grid h-screen grid-cols-[280px_1fr_300px] grid-rows-[auto_1fr] bg-background text-foreground">
      <header className="col-span-3 flex items-center gap-2 border-b border-border px-6 py-3">
        <LayoutGrid className="size-5 text-primary" />
        <h1 className="text-lg font-semibold tracking-tight">michi</h1>
        <span className="text-sm text-muted-foreground">Pokémon Binder Creator</span>
      </header>

      {storageWarning && (
        <div className="col-span-3 bg-amber-500/15 text-amber-600 dark:text-amber-400 text-sm px-6 py-2 border-b border-border">
          {storageWarning}
        </div>
      )}

      <aside className="overflow-y-auto border-r border-border px-6 py-4">
        <GridConfigPanel />
      </aside>

      <main className="flex flex-col overflow-hidden">
        <PageTabs />
        <BinderPageView page={activePage} key={activePage.id} />
      </main>

      <aside className="overflow-y-auto border-l border-border px-6 py-4">
        <ExportPanel />
      </aside>
    </div>
  );
}

function App() {
  return (
    <AppStateProvider>
      <TooltipProvider>
        <AppShell />
      </TooltipProvider>
    </AppStateProvider>
  );
}

export default App;
