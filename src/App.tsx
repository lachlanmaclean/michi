import { AppStateProvider, useAppState } from '@/state/AppStateContext';
import { GridConfigPanel } from '@/components/GridConfigPanel';
import { SearchFilterPanel } from '@/components/SearchFilterPanel';
import { PageTabs } from '@/components/PageTabs';
import { BinderPageView } from '@/components/BinderPageView';
import { ExportPanel } from '@/components/ExportPanel';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Button, buttonVariants } from '@/components/ui/button';
import { useTheme } from '@/hooks/useTheme';
import { LayoutGrid, Coffee, Moon, Sun } from 'lucide-react';

function AppShell() {
  const { state, storageWarning } = useAppState();
  const { theme, toggleTheme } = useTheme();
  const activePage = state.binder.pages.find((p) => p.id === state.activePageId)!;

  return (
    <div className="grid h-screen grid-cols-[280px_1fr_300px] grid-rows-[auto_1fr] bg-background text-foreground">
      <header className="col-span-3 flex items-center gap-2 border-b border-border px-6 py-3">
        <LayoutGrid className="size-5 text-primary" />
        <h1 className="text-lg font-semibold tracking-tight">michi</h1>
        <span className="text-sm text-muted-foreground">Pokémon Binder Creator</span>
        <div className="ml-auto flex items-center gap-2">
          <a
            href="#"
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <Coffee className="size-4" />
            Support me
          </a>
          <Button
            variant="ghost"
            size="icon"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </div>
      </header>

      {storageWarning && (
        <div className="col-span-3 bg-amber-500/15 text-amber-600 dark:text-amber-400 text-sm px-6 py-2 border-b border-border">
          {storageWarning}
        </div>
      )}

      <aside className="overflow-y-auto border-r border-border bg-sidebar px-6 py-4 flex flex-col gap-6">
        <GridConfigPanel />
        <SearchFilterPanel />
      </aside>

      <main className="flex flex-col overflow-hidden">
        <PageTabs />
        <BinderPageView page={activePage} key={activePage.id} />
      </main>

      <aside className="overflow-y-auto border-l border-border bg-sidebar px-6 py-4 flex flex-col">
        <ExportPanel />
        <footer className="mt-6 pt-4 border-t border-border text-xs text-muted-foreground text-center">
          Not affiliated with, endorsed, sponsored, or specifically approved by The Pokémon
          Company, Nintendo, or Game Freak. All card images belong to their respective owners.
        </footer>
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
