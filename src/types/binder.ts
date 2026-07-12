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

/**
 * 'cover' crops/pans/zooms the source image to fill the span (the default,
 * used for uploads). 'fill' stretches the image to exactly fill the span on
 * each axis independently, with no cropping or pan/zoom — used for
 * pre-rendered card art from Search, which is already framed correctly and
 * would otherwise get its edges cut off by cover-cropping.
 */
export type FitMode = 'cover' | 'fill';

export interface ImagePlacement {
  id: string;
  rect: CellRect;
  source: ImageSource;
  crop: CropTransform;
  fitMode: FitMode;
  /**
   * Only meaningful when rect is exactly 1x2 or 2x1. Merges the pair into
   * one seamless double-wide/tall printed card with no internal cut line,
   * instead of two individually-cut cards sharing one image.
   */
  combined: boolean;
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
  /**
   * Whether cards added via card Search (pre-rendered Pokémon TCG art) are
   * included in the exported PDF. When false, they're skipped entirely
   * (never reserving a print slot) — useful for treating them as
   * planning-only placeholders while still printing your own uploads.
   */
  includePokemonCards: boolean;
}

export interface AppState {
  binder: Binder;
  activePageId: string;
  exportSettings: ExportSettings;
  /** Set filter applied to card Search (both the sidebar widget and quick-search) — null means search all sets. */
  searchSetId: string | null;
  schemaVersion: number;
}

export const GRID_PRESETS: Record<Exclude<CardPreset, 'custom'>, { rows: number; cols: number }> = {
  '3x3': { rows: 3, cols: 3 },
  '4x2': { rows: 4, cols: 2 },
  '2x2': { rows: 2, cols: 2 },
  '3x4': { rows: 3, cols: 4 },
};
