import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppState } from '@/state/AppStateContext';
import type { BinderPage, CellRect, ImagePlacement } from '@/types/binder';
import { clampRectToGrid, isCombinablePair, normalizeRect, rectContains, rectsOverlap } from '@/utils/grid';
import { computeWinnerMap } from '@/utils/compositing';
import { ImageAssignDialog } from './ImageAssignDialog';
import { PlacementView } from './PlacementView';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Check, Combine, Pencil, Trash2, X, ZoomIn, ZoomOut } from 'lucide-react';

// Pokemon card aspect ratio is fixed at 2.5:3.5 (portrait), independent of
// grid rows/cols — cells never stretch to a different shape.
const CARD_ASPECT = 2.5 / 3.5;
const CARD_WIDTH_PX = 140;
const CARD_HEIGHT_PX = CARD_WIDTH_PX / CARD_ASPECT;
const GAP_PX = 6;

type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

interface Props {
  page: BinderPage;
  selectedId: string | null;
  onSelectedIdChange: (id: string | null) => void;
}

export function BinderPageView({ page, selectedId, onSelectedIdChange: setSelectedId }: Props) {
  const { dispatch } = useAppState();
  const gridRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [dragAnchor, setDragAnchor] = useState<{ row: number; col: number } | null>(null);
  const [selectionRect, setSelectionRect] = useState<CellRect | null>(null);
  const [dialogRect, setDialogRect] = useState<CellRect | null>(null);
  const [editingPlacement, setEditingPlacement] = useState<ImagePlacement | null>(null);
  const [draftOffset, setDraftOffset] = useState<{ x: number; y: number } | null>(null);
  const resizeState = useRef<{
    placementId: string;
    handle: ResizeHandle;
    originalRect: CellRect;
  } | null>(null);

  const { rows, cols } = page.gridConfig;
  const selectedPlacement = page.placements.find((p) => p.id === selectedId) ?? null;

  // Which placement "wins" each grid cell — the one on the topmost layer
  // covering it. Recomputed whenever placements or layer order change; never
  // stored, so uncovering a lower layer needs no explicit cleanup anywhere.
  const winner = useMemo(() => computeWinnerMap(page), [page]);

  function hiddenCellsFor(placement: ImagePlacement): Set<string> {
    const hidden = new Set<string>();
    for (let row = placement.rect.rowStart; row <= placement.rect.rowEnd; row++) {
      for (let col = placement.rect.colStart; col <= placement.rect.colEnd; col++) {
        if (winner.get(`${row},${col}`) !== placement.id) hidden.add(`${row},${col}`);
      }
    }
    return hidden;
  }

  useEffect(() => {
    // Deselect if the selected placement no longer exists on this page (e.g. grid changed).
    if (selectedId && !page.placements.some((p) => p.id === selectedId)) {
      setSelectedId(null);
      setDraftOffset(null);
    }
  }, [page.placements, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (draftOffset) confirmPan();
        else setSelectedId(null);
      }
    }
    // Any pointerdown outside the grid container (which handles its own
    // deselect-on-click-inside logic) deselects too — e.g. clicking the
    // sidebar, header, or blank page background.
    function onDocPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      const insideGrid = gridRef.current?.contains(target);
      const insideToolbar = toolbarRef.current?.contains(target);
      if (!insideGrid && !insideToolbar) {
        if (draftOffset) confirmPan();
        else setSelectedId(null);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onDocPointerDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, draftOffset]);

  function selectPlacement(id: string) {
    if (id !== selectedId) setDraftOffset(null);
    setSelectedId(id);
  }

  function confirmPan() {
    if (!selectedPlacement || !draftOffset) return;
    dispatch({
      type: 'UPDATE_CROP',
      pageId: page.id,
      placementId: selectedPlacement.id,
      crop: { ...selectedPlacement.crop, offsetX: draftOffset.x, offsetY: draftOffset.y },
    });
    setDraftOffset(null);
    setSelectedId(null);
  }

  function cancelPan() {
    setDraftOffset(null);
  }

  function cellFromPointer(e: React.PointerEvent): { row: number; col: number } | null {
    const el = gridRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const col = Math.min(cols - 1, Math.max(0, Math.floor(x / (CARD_WIDTH_PX + GAP_PX))));
    const row = Math.min(rows - 1, Math.max(0, Math.floor(y / (CARD_HEIGHT_PX + GAP_PX))));
    return { row, col };
  }

  function onGridPointerDown(e: React.PointerEvent) {
    if (resizeState.current) return;
    if (draftOffset) confirmPan();
    setSelectedId(null);
    const cell = cellFromPointer(e);
    if (!cell) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragAnchor(cell);
    setSelectionRect(normalizeRect(cell, cell));
  }

  function onGridPointerMove(e: React.PointerEvent) {
    if (resizeState.current) {
      handleResizeMove(e);
      return;
    }
    if (!dragAnchor) return;
    const cell = cellFromPointer(e);
    if (!cell) return;
    setSelectionRect(normalizeRect(dragAnchor, cell));
  }

  function onGridPointerUp() {
    if (resizeState.current) {
      resizeState.current = null;
      return;
    }
    if (!selectionRect) {
      setDragAnchor(null);
      return;
    }
    const overlaps = page.placements.some(
      (p) => p.layerId === page.activeLayerId && rectsOverlap(p.rect, selectionRect)
    );
    setDragAnchor(null);
    if (overlaps) {
      setSelectionRect(null);
      return;
    }
    setEditingPlacement(null);
    setDialogRect(selectionRect);
    setSelectionRect(null);
  }

  function handleResizeMove(e: React.PointerEvent) {
    const rs = resizeState.current;
    if (!rs) return;
    const cell = cellFromPointer(e);
    if (!cell) return;
    const placement = page.placements.find((p) => p.id === rs.placementId);
    if (!placement) return;

    let { rowStart, colStart, rowEnd, colEnd } = rs.originalRect;
    if (rs.handle.includes('n')) rowStart = Math.min(cell.row, rowEnd);
    if (rs.handle.includes('s')) rowEnd = Math.max(cell.row, rowStart);
    if (rs.handle.includes('w')) colStart = Math.min(cell.col, colEnd);
    if (rs.handle.includes('e')) colEnd = Math.max(cell.col, colStart);

    const nextRect = clampRectToGrid({ rowStart, colStart, rowEnd, colEnd }, rows, cols);
    const overlapsOther = page.placements.some(
      (p) => p.id !== placement.id && p.layerId === placement.layerId && rectsOverlap(p.rect, nextRect)
    );
    if (overlapsOther) return;

    dispatch({ type: 'RESIZE_PLACEMENT', pageId: page.id, placementId: placement.id, rect: nextRect });
  }

  function onResizeStart(placementId: string, handle: ResizeHandle, e: React.PointerEvent) {
    const placement = page.placements.find((p) => p.id === placementId);
    if (!placement) return;
    // Capture on the grid container (stable across the drag) rather than the
    // handle itself — the handle re-renders/moves every pointermove as the
    // rect updates, which would silently drop pointer capture mid-drag.
    gridRef.current?.setPointerCapture(e.pointerId);
    resizeState.current = { placementId, handle, originalRect: placement.rect };
  }

  function closeDialog() {
    setDialogRect(null);
    setEditingPlacement(null);
  }

  function confirmAssign(placement: Omit<ImagePlacement, 'layerId'>) {
    const layerId = editingPlacement ? editingPlacement.layerId : page.activeLayerId;
    const stamped: ImagePlacement = { ...placement, layerId };
    dispatch({ type: 'ASSIGN_IMAGE', pageId: page.id, placement: stamped });
    setSelectedId(stamped.id);
    closeDialog();
  }

  function removePlacement(id: string) {
    dispatch({ type: 'REMOVE_IMAGE', pageId: page.id, placementId: id });
    if (selectedId === id) setSelectedId(null);
    closeDialog();
  }

  function openSwapDialog(placement: ImagePlacement) {
    setEditingPlacement(placement);
    setDialogRect(placement.rect);
  }

  const cellSpanned = (row: number, col: number) =>
    page.placements.some((p) => rectContains(p.rect, row, col));

  // Paint bottom layer first, topmost last — DOM/paint order then naturally
  // matches z-order, so a higher layer's placement also wins pointer events
  // over whatever it visually covers.
  const layerOrder = new Map(page.layers.map((l, i) => [l.id, i]));
  const paintOrderedPlacements = [...page.placements].sort(
    (a, b) => (layerOrder.get(a.layerId) ?? -1) - (layerOrder.get(b.layerId) ?? -1)
  );

  return (
    <div className="flex-1 overflow-auto flex items-start justify-center p-6">
      <div className="flex flex-col items-center gap-3">
        <div className="h-11 flex items-center">
          {selectedPlacement && (
          <div ref={toolbarRef} className="flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1.5 shadow-sm">
            {selectedPlacement.fitMode !== 'fill' && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  title="Zoom out"
                  onClick={() =>
                    dispatch({
                      type: 'UPDATE_CROP',
                      pageId: page.id,
                      placementId: selectedPlacement.id,
                      crop: { ...selectedPlacement.crop, scale: Math.max(1, selectedPlacement.crop.scale - 0.1) },
                    })
                  }
                >
                  <ZoomOut className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  title="Zoom in"
                  onClick={() =>
                    dispatch({
                      type: 'UPDATE_CROP',
                      pageId: page.id,
                      placementId: selectedPlacement.id,
                      crop: { ...selectedPlacement.crop, scale: Math.min(4, selectedPlacement.crop.scale + 0.1) },
                    })
                  }
                >
                  <ZoomIn className="size-4" />
                </Button>
                <div className="w-px h-5 bg-border mx-1" />
              </>
            )}
            {isCombinablePair(selectedPlacement.rect) && (
              <Button
                variant="ghost"
                size="icon"
                className={cn('size-7', selectedPlacement.combined && 'text-primary')}
                title={selectedPlacement.combined ? 'Un-combine' : 'Combine into one seamless card'}
                onClick={() =>
                  dispatch({
                    type: 'SET_COMBINED',
                    pageId: page.id,
                    placementId: selectedPlacement.id,
                    combined: !selectedPlacement.combined,
                  })
                }
              >
                <Combine className="size-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              title="Swap image"
              onClick={() => openSwapDialog(selectedPlacement)}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-destructive hover:text-destructive"
              title="Remove"
              onClick={() => removePlacement(selectedPlacement.id)}
            >
              <Trash2 className="size-4" />
            </Button>
            {draftOffset && (
              <>
                <div className="w-px h-5 bg-border mx-1" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:text-destructive"
                  title="Cancel pan"
                  onClick={cancelPan}
                >
                  <X className="size-4" />
                </Button>
                <Button
                  variant="default"
                  size="icon"
                  className="size-7"
                  title="Confirm pan"
                  onClick={confirmPan}
                >
                  <Check className="size-4" />
                </Button>
              </>
            )}
          </div>
          )}
        </div>

        <div
          ref={gridRef}
          className="relative grid rounded-xl bg-muted/40 p-3 shadow-inner select-none touch-none"
          style={{
            gridTemplateColumns: `repeat(${cols}, ${CARD_WIDTH_PX}px)`,
            gridTemplateRows: `repeat(${rows}, ${CARD_HEIGHT_PX}px)`,
            gap: GAP_PX,
          }}
          onPointerDown={onGridPointerDown}
          onPointerMove={onGridPointerMove}
          onPointerUp={onGridPointerUp}
        >
          {Array.from({ length: rows }).map((_, row) =>
            Array.from({ length: cols }).map((_, col) =>
              cellSpanned(row, col) ? null : (
                <div
                  key={`${row}-${col}`}
                  className="rounded-md border border-dashed border-border bg-card/60"
                  style={{ gridRow: row + 1, gridColumn: col + 1 }}
                />
              )
            )
          )}

          {paintOrderedPlacements.map((placement) => {
            const hiddenCells = hiddenCellsFor(placement);
            const spanCells =
              (placement.rect.rowEnd - placement.rect.rowStart + 1) *
              (placement.rect.colEnd - placement.rect.colStart + 1);
            if (hiddenCells.size === spanCells) return null; // fully covered by a higher layer

            return (
              <PlacementView
                key={placement.id}
                placement={placement}
                selected={placement.id === selectedId}
                cardWidthPx={CARD_WIDTH_PX}
                cardHeightPx={CARD_HEIGHT_PX}
                gapPx={GAP_PX}
                hiddenCells={hiddenCells}
                interactive={placement.layerId === page.activeLayerId || placement.id === selectedId}
                draftOffset={placement.id === selectedId ? draftOffset : null}
                onSelect={(e) => {
                  e.stopPropagation();
                  if (draftOffset) confirmPan();
                  selectPlacement(placement.id);
                }}
                onPanDrag={(x, y) => setDraftOffset({ x, y })}
                onResizeStart={(handle, e) => {
                  selectPlacement(placement.id);
                  onResizeStart(placement.id, handle, e);
                }}
              />
            );
          })}

          {selectionRect && (
            <div
              className="rounded-md border-2 border-primary bg-primary/25 pointer-events-none"
              style={{
                gridRow: `${selectionRect.rowStart + 1} / ${selectionRect.rowEnd + 2}`,
                gridColumn: `${selectionRect.colStart + 1} / ${selectionRect.colEnd + 2}`,
              }}
            />
          )}
        </div>
      </div>

      {dialogRect && (
        <ImageAssignDialog
          rect={dialogRect}
          existingPlacement={editingPlacement}
          onConfirm={confirmAssign}
          onRemove={editingPlacement ? () => removePlacement(editingPlacement.id) : undefined}
          onCancel={closeDialog}
        />
      )}
    </div>
  );
}
