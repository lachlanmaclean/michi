import type { Binder, BinderPage, ImagePlacement } from '../types/binder';
import { computeWinnerMap } from '../utils/compositing';

export interface FlowItem {
  placement: ImagePlacement;
  /** 1x1 for a normal single card or an un-combined multi-cell placement's individual card; 2x1/1x2 (or larger) for a combined block drawn as one seamless unit. */
  spanCols: number;
  spanRows: number;
  /** This item's offset within the placement's own span (0-indexed). */
  sourceColOffset: number;
  sourceRowOffset: number;
  printPageIndex: number;
  row: number; // position in the print grid of this printPageIndex
  col: number;
}

/**
 * Prints each binder page at its exact on-screen grid position — cell
 * (row, col) in the editor always lands at print-grid position (row, col)
 * on its printed page, so a card placed on a layer above another placement
 * prints in that exact physical spot rather than being repacked elsewhere.
 * This is required for layering to make sense on paper (see
 * computeWinnerMap): the whole point of stacking a card over part of a
 * full-art placement is that it prints in that one physical position.
 *
 * Each binder page always starts on its own fresh print page (no packing
 * leftover space from one binder page with cards from the next) — pages
 * with lots of empty pockets will have visible blank gaps in the PDF rather
 * than being tightly bin-packed to save paper. That's an intentional
 * trade-off for correct, predictable positions.
 *
 * A binder page bigger than a whole print page (more columns/rows than fit
 * on one page at true card size) is tiled across multiple dedicated pages —
 * e.g. a 4-wide grid on a 3-wide print page prints columns 0-2 on one page
 * and column 3 alone on the next (same rows) — rather than being cut off
 * past the page edge or shrunk down from true card size.
 */
export function flowPackPlacements(
  binder: Binder,
  printCols: number,
  printRows: number,
  includePokemonCards: boolean
): FlowItem[] {
  const items: FlowItem[] = [];
  let printPageIndex = 0;

  for (const page of binder.pages) {
    const pageItems = flowPackPage(page, printCols, printRows, includePokemonCards);
    if (pageItems.length === 0) continue; // skip pages with no visible content — no blank page reserved

    const pageColsNeeded = Math.max(1, Math.ceil(page.gridConfig.cols / printCols));
    const pageRowsNeeded = Math.max(1, Math.ceil(page.gridConfig.rows / printRows));
    for (const item of pageItems) {
      items.push({ ...item, printPageIndex: item.printPageIndex + printPageIndex });
    }
    printPageIndex += pageColsNeeded * pageRowsNeeded;
  }

  return items;
}

/** Flow-packs a single binder page's placements, with printPageIndex relative to 0 for this page's own tiles. */
function flowPackPage(
  page: BinderPage,
  printCols: number,
  printRows: number,
  includePokemonCards: boolean
): FlowItem[] {
  const items: FlowItem[] = [];
  const winner = computeWinnerMap(page);
  const isCellVisible = (placement: ImagePlacement, row: number, col: number) =>
    winner.get(`${row},${col}`) === placement.id;

  const placements = page.placements.filter((p) => includePokemonCards || p.source.kind !== 'url');
  const pageColsNeeded = Math.max(1, Math.ceil(page.gridConfig.cols / printCols));

  // Which dedicated print page (relative to this binder page's own first
  // tile) a given editor-grid (row, col) belongs to, and its position
  // within that print page's own top-left origin.
  function chunkFor(row: number, col: number) {
    const pr = Math.floor(row / printRows);
    const pc = Math.floor(col / printCols);
    return {
      chunkPageIndex: pr * pageColsNeeded + pc,
      chunkRow: row - pr * printRows,
      chunkCol: col - pc * printCols,
    };
  }

  for (const placement of placements) {
    if (placement.combined) {
      // A seamless combined tile can't print "half" of itself — only draw
      // it if a higher layer covers none of its cells, and only if it
      // doesn't straddle a print-page tiling boundary (it's exactly
      // 1x2/2x1, so this only matters right at a chunk edge).
      let fullyVisible = true;
      for (let r = placement.rect.rowStart; r <= placement.rect.rowEnd && fullyVisible; r++) {
        for (let c = placement.rect.colStart; c <= placement.rect.colEnd; c++) {
          if (!isCellVisible(placement, r, c)) {
            fullyVisible = false;
            break;
          }
        }
      }
      if (!fullyVisible) continue;

      const start = chunkFor(placement.rect.rowStart, placement.rect.colStart);
      const end = chunkFor(placement.rect.rowEnd, placement.rect.colEnd);
      if (start.chunkPageIndex !== end.chunkPageIndex) continue; // straddles a page tile boundary — drop rather than corrupt

      items.push({
        placement,
        spanCols: placement.rect.colEnd - placement.rect.colStart + 1,
        spanRows: placement.rect.rowEnd - placement.rect.rowStart + 1,
        sourceColOffset: 0,
        sourceRowOffset: 0,
        printPageIndex: start.chunkPageIndex,
        row: start.chunkRow,
        col: start.chunkCol,
      });
      continue;
    }

    for (let row = placement.rect.rowStart; row <= placement.rect.rowEnd; row++) {
      for (let col = placement.rect.colStart; col <= placement.rect.colEnd; col++) {
        if (!isCellVisible(placement, row, col)) continue;
        const { chunkPageIndex, chunkRow, chunkCol } = chunkFor(row, col);
        items.push({
          placement,
          spanCols: 1,
          spanRows: 1,
          sourceColOffset: col - placement.rect.colStart,
          sourceRowOffset: row - placement.rect.rowStart,
          printPageIndex: chunkPageIndex,
          row: chunkRow,
          col: chunkCol,
        });
      }
    }
  }

  return items;
}

export function countPrintPages(items: FlowItem[]): number {
  if (items.length === 0) return 1;
  return Math.max(...items.map((i) => i.printPageIndex)) + 1;
}
