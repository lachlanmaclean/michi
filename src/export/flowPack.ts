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

/** A unit to be packed: either a single card-sized cell, or a combined 2-cell seamless block that must land on two adjacent print cells together. */
interface PackUnit {
  placement: ImagePlacement;
  spanCols: number;
  spanRows: number;
  sourceColOffset: number;
  sourceRowOffset: number;
}

/**
 * Packs every visible image tightly across the fewest print pages possible,
 * in placement order, ignoring the binder editor's own blank/empty cells —
 * the editor grid is purely an organizing view; cutting apart printed cards
 * means their position on paper doesn't need to match where they sat in the
 * binder, and leaving blank gaps for empty pockets would waste paper.
 *
 * A combined 1x2/2x1 seamless block is packed as a single unit so its art
 * stays connected across the cut line; everything else packs as individual
 * 1x1 cards. A print page bigger than the combined block's footprint always
 * has room for one — an oversized single placement (spanning more cells
 * than fit on one print page) is packed as-is and will be cut off by the
 * page's print grid, same as before.
 */
export function flowPackPlacements(
  binder: Binder,
  printCols: number,
  printRows: number,
  includePokemonCards: boolean
): FlowItem[] {
  const units: PackUnit[] = [];
  for (const page of binder.pages) {
    units.push(...collectVisibleUnits(page, includePokemonCards));
  }

  const items: FlowItem[] = [];
  const perPage = printCols * printRows;
  // occupied[printPageIndex] is a Set of "row,col" cells already claimed on that page.
  const occupied: Set<string>[] = [];
  let cursorPage = 0;
  let cursorCell = 0; // next candidate cell index (row-major) to try on cursorPage

  function occupiedSetFor(pageIndex: number): Set<string> {
    while (occupied.length <= pageIndex) occupied.push(new Set());
    return occupied[pageIndex];
  }

  function cellFree(pageIndex: number, row: number, col: number): boolean {
    return row < printRows && col < printCols && !occupiedSetFor(pageIndex).has(`${row},${col}`);
  }

  function claim(pageIndex: number, row: number, col: number) {
    occupiedSetFor(pageIndex).add(`${row},${col}`);
  }

  // Advances the shared cursor to the next free single cell, starting from
  // where it left off — cheap because cursorCell only ever moves forward.
  function nextFreeCell(): { pageIndex: number; row: number; col: number } {
    for (;;) {
      if (cursorCell >= perPage) {
        cursorCell = 0;
        cursorPage++;
        continue;
      }
      const row = Math.floor(cursorCell / printCols);
      const col = cursorCell % printCols;
      if (cellFree(cursorPage, row, col)) return { pageIndex: cursorPage, row, col };
      cursorCell++;
    }
  }

  for (const unit of units) {
    if (unit.spanCols === 1 && unit.spanRows === 1) {
      const { pageIndex, row, col } = nextFreeCell();
      claim(pageIndex, row, col);
      items.push({ placement: unit.placement, spanCols: 1, spanRows: 1, sourceColOffset: unit.sourceColOffset, sourceRowOffset: unit.sourceRowOffset, printPageIndex: pageIndex, row, col });
      continue;
    }

    // Combined 2-cell block: scan forward for the first page/position where
    // both of its cells are free and it doesn't run off the page edge,
    // without disturbing cells already claimed by earlier 1x1 units. If the
    // print page is smaller than the block itself (pathologically tiny
    // page size), it can never fit — drop it rather than loop forever.
    if (unit.spanRows > printRows || unit.spanCols > printCols) continue;

    let placed = false;
    for (let pageIndex = cursorPage; !placed; pageIndex++) {
      for (let row = 0; row < printRows && !placed; row++) {
        for (let col = 0; col < printCols && !placed; col++) {
          const row2 = row + unit.spanRows - 1;
          const col2 = col + unit.spanCols - 1;
          if (row2 >= printRows || col2 >= printCols) continue;
          if (!cellFree(pageIndex, row, col) || !cellFree(pageIndex, row2, col2)) continue;
          claim(pageIndex, row, col);
          claim(pageIndex, row2, col2);
          items.push({ placement: unit.placement, spanCols: unit.spanCols, spanRows: unit.spanRows, sourceColOffset: 0, sourceRowOffset: 0, printPageIndex: pageIndex, row, col });
          placed = true;
        }
      }
    }
  }

  return items;
}

/** Collects every visible unit on one binder page (combined blocks kept as 2-cell units, everything else exploded to 1x1), in placement order. */
function collectVisibleUnits(page: BinderPage, includePokemonCards: boolean): PackUnit[] {
  const units: PackUnit[] = [];
  const winner = computeWinnerMap(page);
  const isCellVisible = (placement: ImagePlacement, row: number, col: number) =>
    winner.get(`${row},${col}`) === placement.id;

  const placements = page.placements.filter((p) => includePokemonCards || p.source.kind !== 'url');

  for (const placement of placements) {
    if (placement.combined) {
      // A seamless combined tile can't print "half" of itself — only pack
      // it if no higher layer covers any of its cells.
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

      units.push({
        placement,
        spanCols: placement.rect.colEnd - placement.rect.colStart + 1,
        spanRows: placement.rect.rowEnd - placement.rect.rowStart + 1,
        sourceColOffset: 0,
        sourceRowOffset: 0,
      });
      continue;
    }

    for (let row = placement.rect.rowStart; row <= placement.rect.rowEnd; row++) {
      for (let col = placement.rect.colStart; col <= placement.rect.colEnd; col++) {
        if (!isCellVisible(placement, row, col)) continue;
        units.push({
          placement,
          spanCols: 1,
          spanRows: 1,
          sourceColOffset: col - placement.rect.colStart,
          sourceRowOffset: row - placement.rect.rowStart,
        });
      }
    }
  }

  return units;
}

export function countPrintPages(items: FlowItem[]): number {
  if (items.length === 0) return 1;
  return Math.max(...items.map((i) => i.printPageIndex)) + 1;
}
