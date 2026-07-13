import type { Binder, ImagePlacement } from '../types/binder';
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
 * Flows each placement's whole block (its full colspan x rowspan) as one
 * atomic unit into the print grid — filling each page left-to-right/
 * top-to-bottom, wrapping the whole block to a new row/page if it doesn't
 * fit the remaining space. A block is never split across a page-flow wrap,
 * so a multi-cell image's individual cards always stay in their correct
 * relative 2D position to each other (only their ABSOLUTE position on the
 * page may shift from the binder editor's layout, to keep pages tightly
 * packed with no wasted slots).
 *
 * Each block then expands into one FlowItem per individual card within it
 * (row-major), all sharing the block's print position — this is what lets
 * pdfExport.ts draw a cut line at every individual card boundary even
 * inside a multi-cell placement. A `combined` placement (always exactly
 * 1x2 or 2x1) is the one exception: it stays as a single FlowItem spanning
 * the whole block, since it must print as one seamless card with no cut
 * line through it.
 *
 * A block bigger than a whole print page (more columns/rows than fit on
 * one page at true card size) is tiled across multiple dedicated pages —
 * e.g. a 4-wide image on a 3-wide page prints columns 0-2 on one page and
 * column 3 alone on the next (same rows) — rather than being cut off past
 * the page edge or shrunk down from true card size.
 */
export function flowPackPlacements(
  binder: Binder,
  printCols: number,
  printRows: number,
  includePokemonCards: boolean
): FlowItem[] {
  // Collect placements in page order, then row-major (by rect top-left)
  // within page. Cards added via card Search (source.kind === 'url', the
  // only source that tab produces) are excluded entirely up front when the
  // "Include Pokémon cards" toggle is off, so they never reserve a print
  // slot that would otherwise sit blank once pdfExport.ts skips drawing it.
  const orderedPlacements: ImagePlacement[] = [];
  // Which placement wins each grid cell, keyed by page (a placement never
  // moves between pages, so its id is a stable key into its own page's map)
  // — mirrors the on-screen compositing rule so print output matches what's
  // shown in the editor exactly.
  const winnerByPlacementId = new Map<string, Map<string, string>>();
  for (const page of binder.pages) {
    const winner = computeWinnerMap(page);
    const sorted = [...page.placements]
      .filter((p) => includePokemonCards || p.source.kind !== 'url')
      .sort((a, b) => {
        if (a.rect.rowStart !== b.rect.rowStart) return a.rect.rowStart - b.rect.rowStart;
        return a.rect.colStart - b.rect.colStart;
      });
    for (const p of sorted) winnerByPlacementId.set(p.id, winner);
    orderedPlacements.push(...sorted);
  }

  function isCellVisible(placement: ImagePlacement, row: number, col: number): boolean {
    const winner = winnerByPlacementId.get(placement.id);
    return winner?.get(`${row},${col}`) === placement.id;
  }

  const blocks = orderedPlacements.map((placement) => ({
    placement,
    blockCols: placement.rect.colEnd - placement.rect.colStart + 1,
    blockRows: placement.rect.rowEnd - placement.rect.rowStart + 1,
  }));

  const items: FlowItem[] = [];
  let printPageIndex = 0;
  let row = 0;
  let col = 0;

  for (const block of blocks) {
    // Skip a block entirely (no flow-position advance at all) if every one
    // of its cells is covered by a higher layer — it contributes nothing to
    // print, so it must not reserve a slot as if it were still there.
    let anyVisible = false;
    for (let r = block.placement.rect.rowStart; r <= block.placement.rect.rowEnd && !anyVisible; r++) {
      for (let c = block.placement.rect.colStart; c <= block.placement.rect.colEnd; c++) {
        if (isCellVisible(block.placement, r, c)) {
          anyVisible = true;
          break;
        }
      }
    }
    if (!anyVisible) continue;

    const chunkCols = block.placement.combined ? block.blockCols : Math.min(block.blockCols, printCols);
    const chunkRows = block.placement.combined ? block.blockRows : Math.min(block.blockRows, printRows);

    // Wrap to a new row/page if the first chunk doesn't fit the remaining
    // space — but only if we're not already at the start of a row/page,
    // since wrapping an empty one gains nothing (a chunk exactly as big as
    // the whole print grid would otherwise wrap forever onto a blank page
    // even as the very first item).
    if (col > 0 && col + chunkCols > printCols) {
      col = 0;
      row += 1;
    }
    if (row > 0 && row + chunkRows > printRows) {
      printPageIndex += 1;
      row = 0;
      col = 0;
    }

    if (block.placement.combined) {
      // A seamless combined tile can't print "half" of itself — if a higher
      // layer covers any part of it, the whole block is skipped (already
      // guaranteed not fully-invisible by the anyVisible check above, but
      // "fully visible" is required here specifically, not just "partly").
      let fullyVisible = true;
      for (let r = block.placement.rect.rowStart; r <= block.placement.rect.rowEnd && fullyVisible; r++) {
        for (let c = block.placement.rect.colStart; c <= block.placement.rect.colEnd; c++) {
          if (!isCellVisible(block.placement, r, c)) {
            fullyVisible = false;
            break;
          }
        }
      }
      if (fullyVisible) {
        items.push({
          placement: block.placement,
          spanCols: block.blockCols,
          spanRows: block.blockRows,
          sourceColOffset: 0,
          sourceRowOffset: 0,
          printPageIndex,
          row,
          col,
        });
      }
      col += block.blockCols;
      continue;
    }

    // Tile the block across as many dedicated pages as needed: each
    // pageCol/pageRow chunk starts fresh at col 0 (own page's left edge),
    // except the very first chunk which continues from the current flow
    // position so unrelated cards can still share that first page.
    const pageColsNeeded = Math.ceil(block.blockCols / printCols);
    const pageRowsNeeded = Math.ceil(block.blockRows / printRows);

    for (let pr = 0; pr < pageRowsNeeded; pr++) {
      for (let pc = 0; pc < pageColsNeeded; pc++) {
        const isFirstChunk = pr === 0 && pc === 0;
        const chunkPageIndex = isFirstChunk ? printPageIndex : printPageIndex + pr * pageColsNeeded + pc;
        const chunkRowStart = isFirstChunk ? row : 0;
        const chunkColStart = isFirstChunk ? col : 0;
        const rFrom = pr * printRows;
        const rTo = Math.min(rFrom + printRows, block.blockRows);
        const cFrom = pc * printCols;
        const cTo = Math.min(cFrom + printCols, block.blockCols);

        for (let r = rFrom; r < rTo; r++) {
          for (let c = cFrom; c < cTo; c++) {
            const absRow = block.placement.rect.rowStart + r;
            const absCol = block.placement.rect.colStart + c;
            if (!isCellVisible(block.placement, absRow, absCol)) continue;
            items.push({
              placement: block.placement,
              spanCols: 1,
              spanRows: 1,
              sourceColOffset: c,
              sourceRowOffset: r,
              printPageIndex: chunkPageIndex,
              row: chunkRowStart + (r - rFrom),
              col: chunkColStart + (c - cFrom),
            });
          }
        }
      }
    }

    if (pageColsNeeded > 1 || pageRowsNeeded > 1) {
      // Oversized block consumed one or more whole dedicated pages — resume
      // flowing subsequent placements on a fresh page after the last chunk.
      printPageIndex += pageRowsNeeded * pageColsNeeded - 1;
      row = 0;
      col = 0;
      printPageIndex += 1;
      continue;
    }

    col += block.blockCols;
  }

  return items;
}

export function countPrintPages(items: FlowItem[]): number {
  if (items.length === 0) return 1;
  return Math.max(...items.map((i) => i.printPageIndex)) + 1;
}
