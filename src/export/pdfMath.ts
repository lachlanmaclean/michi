import type { ExportSettings, PageSize } from '../types/binder';

export const PT_PER_INCH = 72;
export const MM_PER_INCH = 25.4;

export const mmToPt = (mm: number) => (mm / MM_PER_INCH) * PT_PER_INCH;

// Standard Pokemon card size: 2.5in x 3.5in (63.5mm x 88.9mm), 0.125in corner radius.
export const CARD_WIDTH_PT = 2.5 * PT_PER_INCH; // 180
export const CARD_HEIGHT_PT = 3.5 * PT_PER_INCH; // 252
export const CARD_CORNER_RADIUS_PT = 0.125 * PT_PER_INCH; // 9

// Standard print convention: keep important content this far inside the
// true card edge, since physical cutting has some tolerance.
export const SAFE_AREA_INSET_MM = 3;

export const PAGE_SIZES_PT: Record<Exclude<PageSize, 'Custom'>, { w: number; h: number }> = {
  Letter: { w: 612, h: 792 },
  A4: { w: 595.28, h: 841.89 },
  Legal: { w: 612, h: 1008 },
  A3: { w: 841.89, h: 1190.55 },
};

/** Resolves the actual page dimensions in points, including the Custom size case. */
export function resolvePageSizePt(settings: ExportSettings): { w: number; h: number } {
  if (settings.pageSize === 'Custom') {
    return { w: mmToPt(settings.customWidthMm), h: mmToPt(settings.customHeightMm) };
  }
  return PAGE_SIZES_PT[settings.pageSize];
}

/**
 * How many true-size cards fit per row/column on the page, accounting for
 * the extra spacing the user has dialed in between cards (beyond their
 * default edge-to-edge tiling).
 */
export function printGridDims(settings: ExportSettings) {
  const { w, h } = resolvePageSizePt(settings);
  const pitchX = CARD_WIDTH_PT + mmToPt(settings.cardSpacingXMm);
  const pitchY = CARD_HEIGHT_PT + mmToPt(settings.cardSpacingYMm);
  return {
    printCols: Math.max(1, Math.floor((w + mmToPt(settings.cardSpacingXMm)) / pitchX)),
    printRows: Math.max(1, Math.floor((h + mmToPt(settings.cardSpacingYMm)) / pitchY)),
  };
}
