export type CardPreset = '3x3' | '4x2' | '2x2' | '3x4' | 'custom';

export interface GridConfig {
  rows: number;
  cols: number;
  preset: CardPreset;
}

/** A rectangular selection of cells, in grid coordinates (0-indexed, inclusive). */
export interface CellRect {
  rowStart: number;
  colStart: number;
  rowEnd: number;
  colEnd: number;
}

export type ImageSource =
  | { kind: 'upload'; dataUrl: string; fileName: string }
  | { kind: 'url'; url: string };

/**
 * Describes how the image is cropped/panned/zoomed within its cell span.
 * The image is scaled so it always covers the span at minimum (like
 * object-fit: cover) — `scale` is a multiplier on top of that minimum
 * (1 = just covers, >1 = zoomed in). `offsetX`/`offsetY` are 0..1
 * fractions of the extra pannable range (0.5 = centered).
 */
export interface CropTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export const DEFAULT_CROP: CropTransform = { scale: 1, offsetX: 0.5, offsetY: 0.5 };

export interface ImagePlacement {
  id: string;
  rect: CellRect;
  source: ImageSource;
  crop: CropTransform;
}

export interface BinderPage {
  id: string;
  gridConfig: GridConfig;
  placements: ImagePlacement[];
}

export interface Binder {
  id: string;
  name: string;
  defaultGridConfig: GridConfig;
  pages: BinderPage[];
}

export type PageSize = 'Letter' | 'A4' | 'Legal' | 'A3' | 'Custom';

export interface ExportSettings {
  pageSize: PageSize;
  /** Only used when pageSize === 'Custom'. */
  customWidthMm: number;
  customHeightMm: number;
  bleedMm: number;
  cropMarkColor: string;
  showCropMarks: boolean;
  cardEdgeColor: string;
  showCardEdge: boolean;
  showSafeArea: boolean;
  /** Extra gap between printed cards, beyond their true edge-to-edge tiling. */
  cardSpacingXMm: number;
  cardSpacingYMm: number;
  /** Nudges the whole print grid on the page, e.g. to compensate for a printer's margin drift. */
  cardOffsetXMm: number;
  cardOffsetYMm: number;
}

export interface AppState {
  binder: Binder;
  activePageId: string;
  exportSettings: ExportSettings;
  schemaVersion: number;
}

export const GRID_PRESETS: Record<Exclude<CardPreset, 'custom'>, { rows: number; cols: number }> = {
  '3x3': { rows: 3, cols: 3 },
  '4x2': { rows: 4, cols: 2 },
  '2x2': { rows: 2, cols: 2 },
  '3x4': { rows: 3, cols: 4 },
};
