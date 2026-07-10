import { PDFDocument, rgb, type Color, PDFOperator, PDFOperatorNames, PDFNumber, popGraphicsState, pushGraphicsState, type PDFImage, type PDFPage } from 'pdf-lib';
import type { Binder, ExportSettings, ImageSource } from '../types/binder';
import { CARD_WIDTH_PT, CARD_HEIGHT_PT, SAFE_AREA_INSET_MM, resolvePageSizePt, mmToPt, printGridDims } from './pdfMath';
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
  // Detect via magic bytes: PNG starts with 89 50 4E 47, JPEG starts with FF D8
  const kind = bytes[0] === 0x89 && bytes[1] === 0x50 ? 'png' : 'jpg';
  return { bytes, kind };
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
  const bleedPt = mmToPt(settings.bleedMm);
  const cropColor = hexToRgb(settings.cropMarkColor);
  const cardEdgeColor = hexToRgb(settings.cardEdgeColor);
  const safeAreaInsetPt = mmToPt(SAFE_AREA_INSET_MM);
  const spacingXPt = mmToPt(settings.cardSpacingXMm);
  const spacingYPt = mmToPt(settings.cardSpacingYMm);
  const offsetXPt = mmToPt(settings.cardOffsetXMm);
  const offsetYPt = mmToPt(settings.cardOffsetYMm);
  const pitchX = CARD_WIDTH_PT + spacingXPt;
  const pitchY = CARD_HEIGHT_PT + spacingYPt;

  const items = flowPackPlacements(binder, printCols, printRows);
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

  function drawCropMarks(page: PDFPage, row: number, col: number) {
    const { cutX, cutY } = cutRectFor(row, col);
    const markLength = 6;
    const offset = 2;
    const corners = [
      { x: cutX, y: cutY }, // bottom-left
      { x: cutX + CARD_WIDTH_PT, y: cutY }, // bottom-right
      { x: cutX, y: cutY + CARD_HEIGHT_PT }, // top-left
      { x: cutX + CARD_WIDTH_PT, y: cutY + CARD_HEIGHT_PT }, // top-right
    ];
    const dirs = [
      { dx: -1, dy: -1 },
      { dx: 1, dy: -1 },
      { dx: -1, dy: 1 },
      { dx: 1, dy: 1 },
    ];
    corners.forEach((corner, i) => {
      const { dx, dy } = dirs[i];
      // horizontal tick
      page.drawLine({
        start: { x: corner.x + dx * offset, y: corner.y },
        end: { x: corner.x + dx * (offset + markLength), y: corner.y },
        thickness: 1.25,
        color: cropColor,
      });
      // vertical tick
      page.drawLine({
        start: { x: corner.x, y: corner.y + dy * offset },
        end: { x: corner.x, y: corner.y + dy * (offset + markLength) },
        thickness: 1.25,
        color: cropColor,
      });
    });
  }

  function drawCardEdge(page: PDFPage, row: number, col: number) {
    const { cutX, cutY } = cutRectFor(row, col);
    // Straight 90° corners (not rounded to the physical card radius) to
    // match Proxxied's cut-line style — this is a cut/registration guide,
    // not a preview of the card's actual rounded corners.
    drawRoundedRectStroke(page, cutX, cutY, CARD_WIDTH_PT, CARD_HEIGHT_PT, 0, cardEdgeColor, 1);
  }

  function drawSafeArea(page: PDFPage, row: number, col: number) {
    const { cutX, cutY } = cutRectFor(row, col);
    drawRoundedRectStroke(
      page,
      cutX + safeAreaInsetPt,
      cutY + safeAreaInsetPt,
      CARD_WIDTH_PT - 2 * safeAreaInsetPt,
      CARD_HEIGHT_PT - 2 * safeAreaInsetPt,
      0,
      cardEdgeColor,
      0.5
    );
  }

  const pdfPages: PDFPage[] = [];
  for (let i = 0; i < numPrintPages; i++) {
    pdfPages.push(pdfDoc.addPage([pageWidth, pageHeight]));
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

    // Every item is a single card now — placements are pre-sliced into
    // individual 1x1 cards before flowing (see flowPack.ts), so each print
    // slot always draws exactly one card-sized, bleed-extended tile.
    const { cutX, cutY } = cutRectFor(item.row, item.col);
    const tileWidth = CARD_WIDTH_PT + 2 * bleedPt;
    const tileHeight = CARD_HEIGHT_PT + 2 * bleedPt;
    const tileX = cutX - bleedPt;
    const tileY = cutY - bleedPt;

    // Mirror the on-screen "cover" crop: scale the image to just cover the
    // placement's FULL span, then apply the extra user zoom/pan on top,
    // matching PlacementView. This card then draws a windowed slice of that
    // same full-span image, offset by however many cards it sits in from
    // the placement's own top-left — this is what lets a multi-card image
    // print as individual cards that still line up seamlessly once cut and
    // reassembled.
    const totalCols = item.placement.rect.colEnd - item.placement.rect.colStart + 1;
    const totalRows = item.placement.rect.rowEnd - item.placement.rect.rowStart + 1;
    const fullWidth = totalCols * CARD_WIDTH_PT;
    const fullHeight = totalRows * CARD_HEIGHT_PT;
    const { scale, offsetX, offsetY } = item.placement.crop;
    const coverScale = Math.max(fullWidth / img.width, fullHeight / img.height);
    const renderedWidth = img.width * coverScale * scale;
    const renderedHeight = img.height * coverScale * scale;
    const rangeX = renderedWidth - fullWidth;
    const rangeY = renderedHeight - fullHeight;
    // Top-left of the full rendered image, relative to this card's own
    // cut-line origin (tileX/tileY shifted back by its source offset within
    // the placement).
    const fullOriginX = tileX - item.sourceColOffset * CARD_WIDTH_PT - rangeX * offsetX;
    // PDF y-axis grows upward; offsetY=0 means "top of image visible", which
    // is the top of the drawn rect, i.e. the highest Y. Also account for
    // this card's row offset within the placement.
    const rowsBelowCard = totalRows - item.sourceRowOffset - 1;
    const fullOriginY = tileY - rowsBelowCard * CARD_HEIGHT_PT - rangeY * (1 - offsetY);

    pdfPage.pushOperators(...pushClipOperators(tileX, tileY, tileWidth, tileHeight));
    pdfPage.drawImage(img, { x: fullOriginX, y: fullOriginY, width: renderedWidth, height: renderedHeight });
    pdfPage.pushOperators(...popClipOperators());

    if (settings.showCropMarks) drawCropMarks(pdfPage, item.row, item.col);
    if (settings.showCardEdge) drawCardEdge(pdfPage, item.row, item.col);
    if (settings.showSafeArea) drawSafeArea(pdfPage, item.row, item.col);
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

// Bezier control-point offset for approximating a quarter circle of radius r.
const ARC_MAGIC = 0.5522847498;

/**
 * Strokes a rounded-rectangle outline — pdf-lib's drawRectangle has no
 * border-radius option, so this builds the path manually: four straight
 * edges connected by quarter-circle bezier arcs at the corners, matching
 * the true card corner radius (used for the Proxxied-style card-edge line).
 */
function drawRoundedRectStroke(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: Color,
  thickness: number
) {
  const n = (v: number) => PDFNumber.of(v);
  const k = radius * ARC_MAGIC;
  const left = x;
  const right = x + width;
  const bottom = y;
  const top = y + height;

  const ops: PDFOperator[] = [
    pushGraphicsState(),
    PDFOperator.of(PDFOperatorNames.SetLineWidth, [n(thickness)]),
    ...colorToStrokeOperator(color),
    PDFOperator.of(PDFOperatorNames.MoveTo, [n(left + radius), n(bottom)]),
    PDFOperator.of(PDFOperatorNames.LineTo, [n(right - radius), n(bottom)]),
    PDFOperator.of(PDFOperatorNames.AppendBezierCurve, [
      n(right - radius + k), n(bottom), n(right), n(bottom + radius - k), n(right), n(bottom + radius),
    ]),
    PDFOperator.of(PDFOperatorNames.LineTo, [n(right), n(top - radius)]),
    PDFOperator.of(PDFOperatorNames.AppendBezierCurve, [
      n(right), n(top - radius + k), n(right - radius + k), n(top), n(right - radius), n(top),
    ]),
    PDFOperator.of(PDFOperatorNames.LineTo, [n(left + radius), n(top)]),
    PDFOperator.of(PDFOperatorNames.AppendBezierCurve, [
      n(left + radius - k), n(top), n(left), n(top - radius + k), n(left), n(top - radius),
    ]),
    PDFOperator.of(PDFOperatorNames.LineTo, [n(left), n(bottom + radius)]),
    PDFOperator.of(PDFOperatorNames.AppendBezierCurve, [
      n(left), n(bottom + radius - k), n(left + radius - k), n(bottom), n(left + radius), n(bottom),
    ]),
    PDFOperator.of(PDFOperatorNames.ClosePath),
    PDFOperator.of(PDFOperatorNames.StrokePath),
    popGraphicsState(),
  ];

  page.pushOperators(...ops);
}

function colorToStrokeOperator(color: Color): PDFOperator[] {
  const n = (v: number) => PDFNumber.of(v);
  if ('red' in color) {
    return [PDFOperator.of(PDFOperatorNames.StrokingColorRgb, [n(color.red), n(color.green), n(color.blue)])];
  }
  if ('gray' in color) {
    return [PDFOperator.of(PDFOperatorNames.StrokingColorGray, [n(color.gray)])];
  }
  return [
    PDFOperator.of(PDFOperatorNames.StrokingColorCmyk, [
      n(color.cyan), n(color.magenta), n(color.yellow), n(color.key),
    ]),
  ];
}

function sourceKey(source: ImageSource): string {
  return source.kind === 'upload' ? `upload:${source.dataUrl}` : `url:${source.url}`;
}

export function downloadPdf(bytes: Uint8Array, fileName = 'michi-binder.pdf') {
  const blob = new Blob([bytes.slice().buffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
