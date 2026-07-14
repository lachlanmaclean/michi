import { PDFDocument, rgb, PDFOperator, PDFOperatorNames, PDFNumber, popGraphicsState, pushGraphicsState, type PDFImage, type PDFPage } from 'pdf-lib';
import type { Binder, ExportSettings, ImageSource } from '../types/binder';
import { CARD_WIDTH_PT, CARD_HEIGHT_PT, resolvePageSizePt, mmToPt, printGridDims } from './pdfMath';
import { flowPackPlacements, countPrintPages } from './flowPack';

function hexToRgb(hex: string) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex) ?? ['', '99', '99', '99'];
  return rgb(parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255);
}

async function fetchImageBytes(source: ImageSource): Promise<{ bytes: Uint8Array; kind: 'png' | 'jpg' }> {
  let bytes: Uint8Array;
  if (source.kind === 'upload') {
    const res = await fetch(source.dataUrl);
    bytes = new Uint8Array(await res.arrayBuffer());
  } else {
    let res: Response;
    try {
      res = await fetch(source.url);
    } catch {
      throw new Error(`Failed to fetch image URL (CORS or network error): ${source.url}`);
    }
    if (!res.ok) throw new Error(`Failed to fetch image URL (${res.status}): ${source.url}`);
    bytes = new Uint8Array(await res.arrayBuffer());
  }
  // Detect via magic bytes: PNG starts with 89 50 4E 47, JPEG starts with FF D8.
  // pdf-lib can only embed PNG/JPEG — anything else (e.g. webp) must fail
  // loudly here rather than being silently misdetected as JPEG, which would
  // otherwise produce a blank/corrupt page with no visible error.
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
  const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8;
  if (!isPng && !isJpg) {
    throw new Error(
      `Unsupported image format (only PNG/JPEG can be embedded in the PDF): ${
        source.kind === 'upload' ? source.fileName : source.url
      }`
    );
  }
  return { bytes, kind: isPng ? 'png' : 'jpg' };
}

export interface ExportError {
  placementId: string;
  message: string;
}

export interface ExportResult {
  bytes: Uint8Array;
  errors: ExportError[];
}

/**
 * Oversized placements are tiled across multiple pages rather than blocked,
 * so this is purely informational — surfaced as a heads-up, not an error
 * that prevents export.
 */
export function describeOversizedPlacements(binder: Binder, settings: ExportSettings): string | null {
  const { printCols, printRows } = printGridDims(settings);
  const count = binder.pages
    .flatMap((p) => p.placements)
    .filter((pl) => {
      const spanCols = pl.rect.colEnd - pl.rect.colStart + 1;
      const spanRows = pl.rect.rowEnd - pl.rect.rowStart + 1;
      return spanCols > printCols || spanRows > printRows;
    }).length;
  if (count === 0) return null;
  return `${count} image${count > 1 ? 's are' : ' is'} larger than a single ${settings.pageSize} page at true card size — will be split across multiple pages, printed sequentially.`;
}

export async function exportBinderToPdf(binder: Binder, settings: ExportSettings): Promise<ExportResult> {
  const { w: pageWidth, h: pageHeight } = resolvePageSizePt(settings);
  const { printCols, printRows } = printGridDims(settings);
  const cardEdgeColor = hexToRgb(settings.cardEdgeColor);
  const pageGuideColor = hexToRgb(settings.pageGuideColor);
  const spacingXPt = mmToPt(settings.cardSpacingXMm);
  const spacingYPt = mmToPt(settings.cardSpacingYMm);
  const offsetXPt = mmToPt(settings.cardOffsetXMm);
  const offsetYPt = mmToPt(settings.cardOffsetYMm);
  const pitchX = CARD_WIDTH_PT + spacingXPt;
  const pitchY = CARD_HEIGHT_PT + spacingYPt;

  const items = flowPackPlacements(binder, printCols, printRows, settings.includePokemonCards);
  const numPrintPages = countPrintPages(items);

  // Grid block width/height is cards-plus-internal-spacing (no trailing
  // spacing after the last card), used to center the whole grid on the page.
  const gridWidthPt = printCols * CARD_WIDTH_PT + (printCols - 1) * spacingXPt;
  const gridHeightPt = printRows * CARD_HEIGHT_PT + (printRows - 1) * spacingYPt;
  const marginLeft = (pageWidth - gridWidthPt) / 2 + offsetXPt;
  const marginTop = (pageHeight - gridHeightPt) / 2 - offsetYPt;

  const pdfDoc = await PDFDocument.create();
  const errors: ExportError[] = [];
  const imageCache = new Map<string, PDFImage>();

  function cutRectFor(row: number, col: number) {
    const cutX = marginLeft + col * pitchX;
    const cutY = pageHeight - marginTop - row * pitchY - CARD_HEIGHT_PT;
    return { cutX, cutY };
  }

  // Crosshairs at every card grid-line intersection across the whole page
  // (Proxxied-style) — one shared crosshair per intersection rather than a
  // separate tick per card corner, drawn uniformly across the full print
  // grid regardless of which cells actually have content.
  function drawGridCrosshairs(page: PDFPage) {
    const markLength = 36;
    const left = marginLeft;
    const bottom = pageHeight - marginTop - gridHeightPt;

    for (let row = 0; row <= printRows; row++) {
      const y = bottom + row * pitchY;
      for (let col = 0; col <= printCols; col++) {
        const x = left + col * pitchX;
        // horizontal arm
        page.drawLine({
          start: { x: x - markLength / 2, y },
          end: { x: x + markLength / 2, y },
          thickness: 2,
          color: cardEdgeColor,
        });
        // vertical arm
        page.drawLine({
          start: { x, y: y - markLength / 2 },
          end: { x, y: y + markLength / 2 },
          thickness: 2,
          color: cardEdgeColor,
        });
      }
    }
  }

  // Full-length straight lines from the outer edge of the printed grid to
  // the paper's edge, on all four sides — for aligning a paper cutter
  // against the whole sheet, as opposed to the per-card crop marks/edge
  // ticks. Drawn once per page along the grid's outer perimeter only (never
  // between individual cards).
  function drawPageGuides(page: PDFPage) {
    const left = marginLeft;
    const right = marginLeft + gridWidthPt;
    const bottom = pageHeight - marginTop - gridHeightPt;
    const top = pageHeight - marginTop;

    // Vertical guides: extend the left/right edges all the way to the top
    // and bottom of the paper.
    [left, right].forEach((x) => {
      page.drawLine({ start: { x, y: 0 }, end: { x, y: pageHeight }, thickness: 1, color: pageGuideColor });
    });
    // Horizontal guides: extend the top/bottom edges all the way to the
    // left and right of the paper.
    [bottom, top].forEach((y) => {
      page.drawLine({ start: { x: 0, y }, end: { x: pageWidth, y }, thickness: 1, color: pageGuideColor });
    });
  }

  const pdfPages: PDFPage[] = [];
  for (let i = 0; i < numPrintPages; i++) {
    const pdfPage = pdfDoc.addPage([pageWidth, pageHeight]);
    if (settings.showPageGuides) drawPageGuides(pdfPage);
    pdfPages.push(pdfPage);
  }

  for (const item of items) {
    const pdfPage = pdfPages[item.printPageIndex];
    const { source, id } = item.placement;

    let img = imageCache.get(sourceKey(source));
    if (!img) {
      try {
        const { bytes, kind } = await fetchImageBytes(source);
        img = kind === 'png' ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
        imageCache.set(sourceKey(source), img);
      } catch (e) {
        errors.push({ placementId: id, message: e instanceof Error ? e.message : String(e) });
        continue;
      }
    }

    // Most items are a single card (placements are sliced into 1x1 cards
    // before flowing — see flowPack.ts); a `combined` placement's item is
    // instead a 2-card unit (spanCols/spanRows > 1) that must draw as one
    // seamless tile with no cut line through its shared boundary.
    // cutRectFor(row, col) gives a single card's bottom-left, so a
    // multi-row unit's bottom-left is that of its BOTTOM-most row.
    const { cutX, cutY } = cutRectFor(item.row + item.spanRows - 1, item.col);
    const unitWidthPt = item.spanCols * CARD_WIDTH_PT;
    const unitHeightPt = item.spanRows * CARD_HEIGHT_PT;

    const totalCols = item.placement.rect.colEnd - item.placement.rect.colStart + 1;
    const totalRows = item.placement.rect.rowEnd - item.placement.rect.rowStart + 1;
    const fullWidth = totalCols * CARD_WIDTH_PT;
    const fullHeight = totalRows * CARD_HEIGHT_PT;

    let fullOriginX: number;
    let fullOriginY: number;
    let renderedWidth: number;
    let renderedHeight: number;

    if (item.placement.fitMode === 'fill') {
      // Stretch to exactly fill the placement's full span on each axis
      // independently (like CSS object-fit: fill) — no cropping, no
      // pan/zoom. Used for pre-rendered card art that's already framed.
      renderedWidth = fullWidth;
      renderedHeight = fullHeight;
      fullOriginX = cutX - item.sourceColOffset * CARD_WIDTH_PT;
      const rowsBelowUnit = totalRows - item.sourceRowOffset - item.spanRows;
      fullOriginY = cutY - rowsBelowUnit * CARD_HEIGHT_PT;
    } else {
      // Mirror the on-screen "cover" crop exactly: scale the image to just
      // cover the placement's FULL span (no bleed margin — every card is
      // strictly confined to its own trim-size box, so it can never
      // visually overlap a neighboring card), then apply the user's
      // pan/zoom on top, matching PlacementView. This unit then draws a
      // windowed slice of that same full-span image, offset by however
      // many cards it sits in from the placement's own top-left — this is
      // what lets a multi-card image print as individual cards (or one
      // combined unit) that still line up seamlessly once cut and
      // reassembled.
      const { scale, offsetX, offsetY } = item.placement.crop;
      const coverScale = Math.max(fullWidth / img.width, fullHeight / img.height);
      renderedWidth = img.width * coverScale * scale;
      renderedHeight = img.height * coverScale * scale;
      const rangeX = renderedWidth - fullWidth;
      const rangeY = renderedHeight - fullHeight;
      fullOriginX = cutX - item.sourceColOffset * CARD_WIDTH_PT - rangeX * offsetX;
      const rowsBelowUnit = totalRows - item.sourceRowOffset - item.spanRows;
      fullOriginY = cutY - rowsBelowUnit * CARD_HEIGHT_PT - rangeY * (1 - offsetY);
    }

    pdfPage.pushOperators(...pushClipOperators(cutX, cutY, unitWidthPt, unitHeightPt));
    pdfPage.drawImage(img, { x: fullOriginX, y: fullOriginY, width: renderedWidth, height: renderedHeight });
    pdfPage.pushOperators(...popClipOperators());
  }

  // Drawn after every card image on every page, so crosshairs are always
  // visible on top of card art at every intersection rather than being
  // hidden underneath opaque cells.
  if (settings.showCardEdge) {
    for (const pdfPage of pdfPages) drawGridCrosshairs(pdfPage);
  }

  const bytes = await pdfDoc.save();
  return { bytes, errors };
}

function pushClipOperators(x: number, y: number, width: number, height: number): PDFOperator[] {
  const n = (v: number) => PDFNumber.of(v);
  return [
    pushGraphicsState(),
    PDFOperator.of(PDFOperatorNames.MoveTo, [n(x), n(y)]),
    PDFOperator.of(PDFOperatorNames.LineTo, [n(x + width), n(y)]),
    PDFOperator.of(PDFOperatorNames.LineTo, [n(x + width), n(y + height)]),
    PDFOperator.of(PDFOperatorNames.LineTo, [n(x), n(y + height)]),
    PDFOperator.of(PDFOperatorNames.ClosePath),
    PDFOperator.of(PDFOperatorNames.ClipNonZero),
    PDFOperator.of(PDFOperatorNames.EndPath),
  ];
}

function popClipOperators(): PDFOperator[] {
  return [popGraphicsState()];
}

function sourceKey(source: ImageSource): string {
  return source.kind === 'upload' ? `upload:${source.dataUrl}` : `url:${source.url}`;
}

export function downloadPdf(bytes: Uint8Array, fileName = 'bindermon-binder.pdf') {
  const blob = new Blob([bytes.slice().buffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
