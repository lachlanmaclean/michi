import { useAppState } from '@/state/AppStateContext';
import type { BinderPage } from '@/types/binder';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  page: BinderPage;
  selectedId: string | null;
  onSelectPlacement: (id: string) => void;
}

export function LayerPanel({ page, selectedId, onSelectPlacement }: Props) {
  const { dispatch } = useAppState();
  // Displayed topmost-first (matches visual stacking); the underlying array
  // stays bottom-to-top (index 0 = bottom), so list position is reversed
  // relative to page.layers.
  const layersTopFirst = [...page.layers].reverse();

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-base font-semibold">Layers</h3>
      <div className="flex flex-col gap-1.5">
        {layersTopFirst.map((layer, i) => {
          const active = layer.id === page.activeLayerId;
          const isTop = i === 0;
          const isBottom = i === layersTopFirst.length - 1;
          const layerPlacements = page.placements.filter((p) => p.layerId === layer.id);
          return (
            <div
              key={layer.id}
              className={cn(
                'rounded-md border px-2 py-1.5 transition-colors',
                active ? 'border-primary bg-primary/10' : 'border-border'
              )}
            >
              <div className="flex items-center gap-1">
                <div className="flex flex-col -my-1">
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                    title="Raise layer"
                    disabled={isTop}
                    onClick={() =>
                      dispatch({ type: 'REORDER_LAYER', pageId: page.id, layerId: layer.id, direction: 'raise' })
                    }
                  >
                    <ChevronUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                    title="Lower layer"
                    disabled={isBottom}
                    onClick={() =>
                      dispatch({ type: 'REORDER_LAYER', pageId: page.id, layerId: layer.id, direction: 'lower' })
                    }
                  >
                    <ChevronDown className="size-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  className="flex-1 text-left text-sm truncate cursor-pointer"
                  onClick={() => dispatch({ type: 'SET_ACTIVE_LAYER', pageId: page.id, layerId: layer.id })}
                >
                  {layer.name}
                </button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-destructive hover:text-destructive disabled:opacity-30"
                  title="Delete layer"
                  disabled={page.layers.length <= 1}
                  onClick={() => dispatch({ type: 'REMOVE_LAYER', pageId: page.id, layerId: layer.id })}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>

              {layerPlacements.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5 pl-5">
                  {layerPlacements.map((placement) => {
                    const src =
                      placement.source.kind === 'upload' ? placement.source.dataUrl : placement.source.url;
                    return (
                      <button
                        type="button"
                        key={placement.id}
                        title="Select this placement"
                        onClick={() => onSelectPlacement(placement.id)}
                        className={cn(
                          'size-7 rounded overflow-hidden border-2 shrink-0',
                          placement.id === selectedId ? 'border-primary' : 'border-transparent'
                        )}
                      >
                        <img src={src} alt="" className="w-full h-full object-cover" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1 justify-start"
        onClick={() => dispatch({ type: 'ADD_LAYER', pageId: page.id })}
      >
        <Plus className="size-4" />
        Add layer
      </Button>
    </div>
  );
}
