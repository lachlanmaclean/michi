import { useRef, useState } from 'react';
import type { CropTransform, ImagePlacement } from '@/types/binder';
import { cn } from '@/lib/utils';

type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

interface Props {
  placement: ImagePlacement;
  selected: boolean;
  cardWidthPx: number;
  cardHeightPx: number;
  gapPx: number;
  /** Uncommitted pan offset while a pan drag is in progress (or awaiting confirm/cancel). */
  draftOffset: { x: number; y: number } | null;
  onSelect: (e: React.PointerEvent) => void;
  onPanDrag: (offsetX: number, offsetY: number) => void;
  onZoom: (scale: number) => void;
  onResizeStart: (handle: ResizeHandle, e: React.PointerEvent) => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;

export function PlacementView({
  placement,
  selected,
  cardWidthPx,
  cardHeightPx,
  gapPx,
  draftOffset,
  onSelect,
  onPanDrag,
  onZoom,
  onResizeStart,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panState = useRef<{
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);

  const spanCols = placement.rect.colEnd - placement.rect.colStart + 1;
  const spanRows = placement.rect.rowEnd - placement.rect.rowStart + 1;
  // The "content" size is just the cards themselves, edge to edge, ignoring
  // the internal gaps — this is what the image is cropped/panned/zoomed
  // against (matches the PDF export, where cards tile with no gap).
  const spanWidthPx = spanCols * cardWidthPx;
  const spanHeightPx = spanRows * cardHeightPx;
  // The container's actual pixel box (from CSS grid) additionally includes
  // the internal gaps between cards within this span.
  const containerWidthPx = spanWidthPx + (spanCols - 1) * gapPx;
  const containerHeightPx = spanHeightPx + (spanRows - 1) * gapPx;

  const isFill = placement.fitMode === 'fill';

  const { scale }: CropTransform = placement.crop;
  const displayOffsetX = draftOffset?.x ?? placement.crop.offsetX;
  const displayOffsetY = draftOffset?.y ?? placement.crop.offsetY;

  // Explicit pixel sizing (rather than CSS object-fit: cover) so the
  // on-screen render matches the pan-range math exactly, and matches the
  // PDF export exactly (no bleed margin — every card is strictly confined
  // to its own trim-size box, so cards can never visually overlap a
  // neighboring card).
  const coverScale = naturalSize
    ? Math.max(spanWidthPx / naturalSize.w, spanHeightPx / naturalSize.h)
    : 0;
  const renderedWidth = naturalSize ? naturalSize.w * coverScale * scale : spanWidthPx;
  const renderedHeight = naturalSize ? naturalSize.h * coverScale * scale : spanHeightPx;

  function onImagePointerDown(e: React.PointerEvent) {
    // Pre-rendered card art (fill mode) is stretched to fit exactly, with no
    // pan/zoom to perform.
    if (isFill) {
      onSelect(e);
      return;
    }
    if (!selected) {
      onSelect(e);
      return;
    }
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    panState.current = { startX: e.clientX, startY: e.clientY, startOffsetX: displayOffsetX, startOffsetY: displayOffsetY };
  }

  function onImagePointerMove(e: React.PointerEvent) {
    if (!panState.current) return;
    e.stopPropagation();
    const dx = e.clientX - panState.current.startX;
    const dy = e.clientY - panState.current.startY;
    // Convert pixel delta to a 0..1 offset delta relative to the pannable
    // range: how much bigger the rendered image is than the (gap-less)
    // card content area on each axis.
    const rangeX = renderedWidth - spanWidthPx;
    const rangeY = renderedHeight - spanHeightPx;
    const deltaOffsetX = rangeX > 0 ? -dx / rangeX : 0;
    const deltaOffsetY = rangeY > 0 ? -dy / rangeY : 0;
    const nextX = clamp01(panState.current.startOffsetX + deltaOffsetX);
    const nextY = clamp01(panState.current.startOffsetY + deltaOffsetY);
    onPanDrag(nextX, nextY);
  }

  function onImagePointerUp(e: React.PointerEvent) {
    if (panState.current) {
      e.stopPropagation();
      panState.current = null;
    }
  }

  function onWheel(e: React.WheelEvent) {
    if (!selected || isFill) return;
    e.preventDefault();
    e.stopPropagation();
    const delta = -e.deltaY * 0.001;
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale + delta));
    onZoom(next);
  }

  const src = placement.source.kind === 'upload' ? placement.source.dataUrl : placement.source.url;

  // Image left/top edge, relative to the card-content box's own top-left
  // (i.e. before accounting for which card tile we're rendering into).
  const imageLeft = (containerWidthPx - renderedWidth) / 2 - (displayOffsetX - 0.5) * (renderedWidth - spanWidthPx);
  const imageTop = (containerHeightPx - renderedHeight) / 2 - (displayOffsetY - 0.5) * (renderedHeight - spanHeightPx);

  function renderImage(tileLeft: number, tileTop: number, isFirst: boolean) {
    if (isFill) {
      return (
        <img
          src={src}
          alt=""
          draggable={false}
          className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none"
        />
      );
    }
    return (
      <img
        src={src}
        alt=""
        draggable={false}
        onLoad={
          isFirst
            ? (e) => {
                const el = e.currentTarget;
                setNaturalSize({ w: el.naturalWidth, h: el.naturalHeight });
              }
            : undefined
        }
        className="absolute max-w-none pointer-events-none select-none"
        style={{
          width: renderedWidth,
          height: renderedHeight,
          left: imageLeft - tileLeft,
          top: imageTop - tileTop,
        }}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative grid"
      style={{
        gridRow: `${placement.rect.rowStart + 1} / ${placement.rect.rowEnd + 2}`,
        gridColumn: `${placement.rect.colStart + 1} / ${placement.rect.colEnd + 2}`,
        gridTemplateColumns: `repeat(${spanCols}, ${cardWidthPx}px)`,
        gridTemplateRows: `repeat(${spanRows}, ${cardHeightPx}px)`,
        gap: placement.combined ? 0 : gapPx,
      }}
      onPointerDown={onImagePointerDown}
      onPointerMove={onImagePointerMove}
      onPointerUp={onImagePointerUp}
      onWheel={onWheel}
    >
      {placement.combined ? (
        // Combined: one seamless tile spanning the whole rect, no internal
        // gap/border between the two cards — they're meant to print and be
        // handled as a single double-wide/double-tall card, not two cards
        // that happen to share an image.
        <div
          className={cn(
            'relative rounded-md overflow-hidden cursor-pointer border-2 transition-colors',
            selected ? 'border-primary z-10' : 'border-transparent hover:border-primary/60'
          )}
          style={{ gridColumn: `1 / -1`, gridRow: `1 / -1` }}
        >
          {renderImage(0, 0, true)}
        </div>
      ) : (
        Array.from({ length: spanRows }).map((_, r) =>
          Array.from({ length: spanCols }).map((_, c) => {
            // This card's offset within the card-content box (cards tile
            // edge-to-edge here, ignoring gaps, matching the crop math).
            const tileLeft = c * cardWidthPx;
            const tileTop = r * cardHeightPx;
            return (
              <div
                key={`${r}-${c}`}
                className={cn(
                  'relative rounded-md overflow-hidden cursor-pointer border-2 transition-colors',
                  selected ? 'border-primary z-10' : 'border-transparent hover:border-primary/60'
                )}
                style={{ width: cardWidthPx, height: cardHeightPx }}
              >
                {renderImage(tileLeft, tileTop, r === 0 && c === 0)}
              </div>
            );
          })
        )
      )}

      {selected && (
        <>
          {(['nw', 'ne', 'sw', 'se'] as ResizeHandle[]).map((handle) => (
            <div
              key={handle}
              className="absolute size-3 rounded-full bg-primary border-2 border-background shadow z-20"
              style={{ cursor: `${handle}-resize`, ...handleAbsolutePosition(handle) }}
              onPointerDown={(e) => {
                e.stopPropagation();
                onResizeStart(handle, e);
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

function handleAbsolutePosition(handle: ResizeHandle): React.CSSProperties {
  switch (handle) {
    case 'nw':
      return { top: -6, left: -6 };
    case 'ne':
      return { top: -6, right: -6 };
    case 'sw':
      return { bottom: -6, left: -6 };
    case 'se':
      return { bottom: -6, right: -6 };
    default:
      return {};
  }
}
