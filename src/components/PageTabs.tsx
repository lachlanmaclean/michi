import { useAppState } from '@/state/AppStateContext';
import { Button } from '@/components/ui/button';
import { X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PageTabs() {
  const { state, dispatch } = useAppState();

  return (
    <div className="flex items-center gap-2 flex-wrap px-6 pt-4">
      {state.binder.pages.map((page, i) => {
        const active = page.id === state.activePageId;
        return (
          <div
            key={page.id}
            className={cn(
              'flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm cursor-pointer transition-colors',
              active
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-secondary text-secondary-foreground border-border hover:bg-secondary/70'
            )}
            onClick={() => dispatch({ type: 'SET_ACTIVE_PAGE', pageId: page.id })}
          >
            Page {i + 1}
            {state.binder.pages.length > 1 && (
              <X
                className="size-3.5 opacity-60 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: 'REMOVE_PAGE', pageId: page.id });
                }}
              />
            )}
          </div>
        );
      })}
      <Button
        variant="ghost"
        size="sm"
        className="gap-1"
        onClick={() => dispatch({ type: 'ADD_PAGE' })}
      >
        <Plus className="size-4" />
        Add page
      </Button>
    </div>
  );
}
