import type { CellRect } from '../types/binder';

export function normalizeRect(a: { row: number; col: number }, b: { row: number; col: number }): CellRect {
  return {
    rowStart: Math.min(a.row, b.row),
    colStart: Math.min(a.col, b.col),
    rowEnd: Math.max(a.row, b.row),
    colEnd: Math.max(a.col, b.col),
  };
}

export function rectsOverlap(a: CellRect, b: CellRect): boolean {
  return (
    a.rowStart <= b.rowEnd &&
    a.rowEnd >= b.rowStart &&
    a.colStart <= b.colEnd &&
    a.colEnd >= b.colStart
  );
}

export function rectContains(rect: CellRect, row: number, col: number): boolean {
  return row >= rect.rowStart && row <= rect.rowEnd && col >= rect.colStart && col <= rect.colEnd;
}

/** True for a rect that's exactly 1x2 or 2x1 — the only shapes eligible for the "combine" seamless-tile feature. */
export function isCombinablePair(rect: CellRect): boolean {
  const spanCols = rect.colEnd - rect.colStart + 1;
  const spanRows = rect.rowEnd - rect.rowStart + 1;
  return (spanCols === 2 && spanRows === 1) || (spanCols === 1 && spanRows === 2);
}

export function clampRectToGrid(rect: CellRect, rows: number, cols: number): CellRect {
  return {
    rowStart: Math.max(0, Math.min(rect.rowStart, rows - 1)),
    colStart: Math.max(0, Math.min(rect.colStart, cols - 1)),
    rowEnd: Math.max(0, Math.min(rect.rowEnd, rows - 1)),
    colEnd: Math.max(0, Math.min(rect.colEnd, cols - 1)),
  };
}

/** Shifts a rect by a row/col delta without changing its span (rowEnd-rowStart, colEnd-colStart stay fixed). */
export function translateRect(rect: CellRect, deltaRow: number, deltaCol: number): CellRect {
  return {
    rowStart: rect.rowStart + deltaRow,
    colStart: rect.colStart + deltaCol,
    rowEnd: rect.rowEnd + deltaRow,
    colEnd: rect.colEnd + deltaCol,
  };
}

/**
 * Slides a rect back within grid bounds by moving its anchor (top-left),
 * preserving its span — unlike clampRectToGrid, which clamps each corner
 * independently and would shrink/distort a rect that overhangs an edge.
 */
export function clampRectPositionToGrid(rect: CellRect, rows: number, cols: number): CellRect {
  const spanRows = rect.rowEnd - rect.rowStart;
  const spanCols = rect.colEnd - rect.colStart;
  const rowStart = Math.max(0, Math.min(rect.rowStart, rows - 1 - spanRows));
  const colStart = Math.max(0, Math.min(rect.colStart, cols - 1 - spanCols));
  return {
    rowStart,
    colStart,
    rowEnd: rowStart + spanRows,
    colEnd: colStart + spanCols,
  };
}
