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

export function clampRectToGrid(rect: CellRect, rows: number, cols: number): CellRect {
  return {
    rowStart: Math.max(0, Math.min(rect.rowStart, rows - 1)),
    colStart: Math.max(0, Math.min(rect.colStart, cols - 1)),
    rowEnd: Math.max(0, Math.min(rect.rowEnd, rows - 1)),
    colEnd: Math.max(0, Math.min(rect.colEnd, cols - 1)),
  };
}
