import { useEffect, useMemo, useState } from 'react';
import { useAppState } from '@/state/AppStateContext';
import { fetchTcgdexSets, type TcgdexSetBrief } from '@/utils/tcgdex';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Loader2, Search, X } from 'lucide-react';

export function SearchFilterPanel() {
  const { state, dispatch } = useAppState();
  const [sets, setSets] = useState<TcgdexSetBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetchTcgdexSets()
      .then(setSets)
      .catch(() => setSets([]))
      .finally(() => setLoading(false));
  }, []);

  const selectedSet = sets.find((s) => s.id === state.searchSetId) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sets;
    return sets.filter((s) => s.name.toLowerCase().includes(q));
  }, [sets, query]);

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-base font-semibold">Search Filter</h3>

      {selectedSet ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-2 py-1.5 text-sm">
          <span className="truncate">{selectedSet.name}</span>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground shrink-0"
            title="Clear set filter"
            onClick={() => dispatch({ type: 'SET_SEARCH_SET', setId: null })}
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Type to find a set…"
            className="pl-8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      {!selectedSet && (
        <>
          {loading && (
            <div className="flex items-center justify-center py-4 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
            </div>
          )}
          {!loading && query.trim() && (
            <div className="flex flex-col max-h-56 overflow-y-auto rounded-md border border-border">
              {filtered.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">No sets found.</p>
              )}
              {filtered.map((set) => (
                <button
                  key={set.id}
                  type="button"
                  className={cn(
                    'text-left text-sm px-2 py-1.5 hover:bg-muted/60 transition-colors not-last:border-b border-border'
                  )}
                  onClick={() => {
                    dispatch({ type: 'SET_SEARCH_SET', setId: set.id });
                    setQuery('');
                  }}
                >
                  {set.name}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <p className="text-xs text-muted-foreground">
        Card searches (including clicking an empty slot to quick-add) are limited to this set. Leave
        empty to search all sets.
      </p>
    </div>
  );
}
