import type { Binder, ImagePlacement } from '../types/binder';

export interface FlowItem {
  placement: ImagePlacement;
  /** Always 1x1 — every placement is pre-sliced into individual cards before flowing. */
  spanCols: 1;
  spanRows: 1;
  /** This card's offset within the placement's own span (0-indexed). */
  sourceColOffset: number;
  sourceRowOffset: number;
  printPageIndex: number;
  row: number; // position in the print grid of this printPageIndex
  col: number;
}

/**
 * Slices every placement into its individual 1x1 cards (in reading order:
 * page order, then row-major within the placement's own span), then flows
 * those cards sequentially into the print grid — filling each page
 * completely, left-to-right/top-to-bottom, before starting the next. This
 * is simpler than 2D bin-packing a placement's whole span as one block: a
 * multi-card image's cards individually flow like any other single card,
 * so no page is ever left with unused slots while a later card could have
 * filled them, and a placement's cards always stay in their natural
 * relative reading order to each other and to other placements.
 */
export function flowPackPlacements(
  binder: Binder,
  printCols: number,
  printRows: number
): FlowItem[] {
  // Collect placements in page order, then row-major (by rect top-left) within page.
  const orderedPlacements: ImagePlacement[] = [];
  for (const page of binder.pages) {
    const sorted = [...page.placements].sort((a, b) => {
      if (a.rect.rowStart !== b.rect.rowStart) return a.rect.rowStart - b.rect.rowStart;
      return a.rect.colStart - b.rect.colStart;
    });
    orderedPlacements.push(...sorted);
  }

  // Slice each placement into individual 1x1 cards, row-major within its span.
  const cards: { placement: ImagePlacement; sourceColOffset: number; sourceRowOffset: number }[] = [];
  for (const placement of orderedPlacements) {
    const totalCols = placement.rect.colEnd - placement.rect.colStart + 1;
    const totalRows = placement.rect.rowEnd - placement.rect.rowStart + 1;
    for (let r = 0; r < totalRows; r++) {
      for (let c = 0; c < totalCols; c++) {
        cards.push({ placement, sourceColOffset: c, sourceRowOffset: r });
      }
    }
  }

  const items: FlowItem[] = [];
  let printPageIndex = 0;
  let row = 0;
  let col = 0;

  for (const card of cards) {
    if (col >= printCols) {
      col = 0;
      row += 1;
    }
    if (row >= printRows) {
      printPageIndex += 1;
      row = 0;
      col = 0;
    }

    items.push({
      placement: card.placement,
      spanCols: 1,
      spanRows: 1,
      sourceColOffset: card.sourceColOffset,
      sourceRowOffset: card.sourceRowOffset,
      printPageIndex,
      row,
      col,
    });
    col += 1;
  }

  return items;
}

export function countPrintPages(items: FlowItem[]): number {
  if (items.length === 0) return 1;
  return Math.max(...items.map((i) => i.printPageIndex)) + 1;
}
