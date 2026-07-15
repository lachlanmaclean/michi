import { useEffect, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { DEFAULT_CROP, type CellRect, type FitMode, type ImagePlacement, type ImageSource } from '@/types/binder';
import { fileToDataUrl } from '@/utils/imageLoad';
import {
  searchTcgdexCards,
  tcgdexImageUrl,
  tcgdexThumbnailUrl,
  parseCardQuery,
  findSetsByCardCount,
  fetchTcgdexSets,
  type TcgdexCardBrief,
} from '@/utils/tcgdex';
import { useAppState } from '@/state/AppStateContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  rect: CellRect;
  existingPlacement: ImagePlacement | null;
  onConfirm: (placement: Omit<ImagePlacement, 'layerId'>) => void;
  onRemove?: () => void;
  onCancel: () => void;
}

export function ImageAssignDialog({ rect, existingPlacement, onConfirm, onRemove, onCancel }: Props) {
  const { state } = useAppState();
  const spanCols = rect.colEnd - rect.colStart + 1;
  const spanRows = rect.rowEnd - rect.rowStart + 1;
  // Card search returns a single pre-rendered card image, which only makes
  // sense for a plain 1x1 slot — a multi-cell span needs one image spread
  // across cards, which search can't provide.
  const canSearch = spanCols === 1 && spanRows === 1;
  const [tab, setTab] = useState<'search' | 'upload'>(canSearch ? 'search' : 'upload');
  const [preview, setPreview] = useState<ImageSource | null>(existingPlacement?.source ?? null);
  const [fitMode, setFitMode] = useState<FitMode>(existingPlacement?.fitMode ?? 'cover');
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TcgdexCardBrief[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(searchTimer.current);
    if (!query.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const parsed = parseCardQuery(query);
        // A "170/165"-style set total only resolves a set when the user
        // hasn't already picked one in the sidebar filter — an explicit
        // filter always wins. Card counts collide across sets often enough
        // (multiple real sets can share the same total) that this can't
        // assume a single match: query every candidate set in parallel and
        // merge, so the card name (already part of the query) is what
        // actually disambiguates which one the user meant.
        let cards: TcgdexCardBrief[];
        if (!state.searchSetId && parsed.setTotal) {
          const sets = await fetchTcgdexSets();
          const candidates = findSetsByCardCount(sets, parsed.setTotal);
          const batches = await Promise.all(
            candidates.map((set) =>
              searchTcgdexCards(parsed.name, set.id, state.searchFullArtOnly, parsed.localId, parsed.rarity).catch(
                () => []
              )
            )
          );
          const seen = new Set<string>();
          cards = [];
          for (const batch of batches) {
            for (const card of batch) {
              if (seen.has(card.id)) continue;
              seen.add(card.id);
              cards.push(card);
            }
          }
        } else {
          cards = await searchTcgdexCards(
            parsed.name,
            state.searchSetId ?? undefined,
            state.searchFullArtOnly,
            parsed.localId,
            parsed.rarity
          );
        }
        cards = cards.filter((c) => tcgdexImageUrl(c));
        // Exactly one match — skip the preview/Assign step and place it
        // immediately, closing the dialog.
        if (cards.length === 1) {
          confirmCard(cards[0]);
          return;
        }
        setResults(cards);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(searchTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, state.searchSetId, state.searchFullArtOnly]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setPreview({ kind: 'upload', dataUrl, fileName: file.name });
      setFitMode('cover');
      setError(null);
    } catch {
      setError('Could not read that file.');
    }
  }

  function selectCard(card: TcgdexCardBrief) {
    const imageUrl = tcgdexImageUrl(card);
    if (!imageUrl) return;
    setSelectedCardId(card.id);
    setPreview({ kind: 'url', url: imageUrl });
    // Pre-rendered card art is already framed correctly — stretch to fill
    // exactly, no cropping/pan/zoom.
    setFitMode('fill');
    setError(null);
  }

  /** Places a card immediately, skipping the preview/Assign step — used when a search has exactly one match. */
  function confirmCard(card: TcgdexCardBrief) {
    const imageUrl = tcgdexImageUrl(card);
    if (!imageUrl) return;
    onConfirm({
      id: existingPlacement?.id ?? uuid(),
      rect,
      source: { kind: 'url', url: imageUrl },
      crop: DEFAULT_CROP,
      fitMode: 'fill',
      combined: existingPlacement?.combined ?? false,
    });
  }

  function confirm() {
    if (!preview) {
      setError('Choose an image first.');
      return;
    }
    // Swapping the image source resets crop, since scale/offset were tuned
    // for the old image's framing.
    const sourceChanged = !existingPlacement || preview !== existingPlacement.source;
    onConfirm({
      id: existingPlacement?.id ?? uuid(),
      rect,
      source: preview,
      crop: existingPlacement && !sourceChanged ? existingPlacement.crop : DEFAULT_CROP,
      fitMode,
      combined: existingPlacement?.combined ?? false,
    });
  }

  const previewSrc = preview ? (preview.kind === 'upload' ? preview.dataUrl : preview.url) : null;

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {existingPlacement ? 'Edit image' : 'Assign image'} — {spanCols}×{spanRows}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'search' | 'upload')}>
          <TabsList className={cn('grid w-full', canSearch ? 'grid-cols-2' : 'grid-cols-1')}>
            {canSearch && <TabsTrigger value="search">Search</TabsTrigger>}
            <TabsTrigger value="upload">Upload</TabsTrigger>
          </TabsList>

          {canSearch && (
            <TabsContent value="search" className="pt-2 flex flex-col gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by name, e.g. Squirtle IR 170/165…"
                  className="pl-8"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              {searching && (
                <div className="flex items-center justify-center py-6 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                </div>
              )}

              {!searching && query.trim() && results.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No cards found.</p>
              )}

              {!searching && results.length > 0 && (
                <div className="grid grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto p-1">
                  {results.map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => selectCard(card)}
                      className={cn(
                        'rounded-md overflow-hidden border-2 transition-colors bg-muted',
                        selectedCardId === card.id
                          ? 'border-primary'
                          : 'border-transparent hover:border-primary/60'
                      )}
                      title={card.name}
                    >
                      <img
                        src={tcgdexThumbnailUrl(card) ?? tcgdexImageUrl(card)!}
                        alt={card.name}
                        className="w-full h-auto"
                        style={{ aspectRatio: '2.5 / 3.5' }}
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>
          )}

          <TabsContent value="upload" className="pt-2">
            <Input type="file" accept="image/*" onChange={(e) => handleFile(e.target.files?.[0])} />
          </TabsContent>
        </Tabs>

        {previewSrc && (
          <div className="rounded-md overflow-hidden max-h-52 border border-border">
            <img src={previewSrc} alt="preview" className="w-full h-full object-contain bg-muted" />
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter className="gap-2 sm:gap-0">
          {onRemove && (
            <Button variant="destructive" className="sm:mr-auto" onClick={onRemove}>
              Remove
            </Button>
          )}
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={confirm}>{existingPlacement ? 'Save' : 'Assign'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
