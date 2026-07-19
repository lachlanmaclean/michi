import { useState } from 'react';
import { useAppState } from '@/state/AppStateContext';
import type { PageSize } from '@/types/binder';
import { PAGE_SIZES_PT } from '@/export/pdfMath';
import { exportBinderToPdf, downloadPdf, describeOversizedPlacements, type ExportError } from '@/export/pdfExport';
import { recordExportTally } from '@/utils/exportTally';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LayoutGrid, Move, Scan, Loader2 } from 'lucide-react';

const PAGE_SIZES: PageSize[] = ['Letter', 'A4', 'Legal', 'A3', 'Custom'];
const MM_PER_INCH = 25.4;

function mmToIn(mm: number) {
  return mm / MM_PER_INCH;
}

export function ExportPanel() {
  const { state, dispatch } = useAppState();
  const { exportSettings } = state;
  const [exporting, setExporting] = useState(false);
  const [errors, setErrors] = useState<ExportError[]>([]);

  const oversizedNote = describeOversizedPlacements(state.binder, exportSettings);

  function update(settings: Partial<typeof exportSettings>) {
    dispatch({ type: 'UPDATE_EXPORT_SETTINGS', settings });
  }

  function swapOrientation() {
    if (exportSettings.pageSize === 'Custom') {
      update({ customWidthMm: exportSettings.customHeightMm, customHeightMm: exportSettings.customWidthMm });
      return;
    }
    const { w, h } = PAGE_SIZES_PT[exportSettings.pageSize];
    // Swapping a preset's orientation is really just a custom w/h with the
    // dims flipped — presets don't otherwise track portrait/landscape.
    update({
      pageSize: 'Custom',
      customWidthMm: mmFromPt(h),
      customHeightMm: mmFromPt(w),
    });
  }

  async function handleExport() {
    setExporting(true);
    setErrors([]);
    try {
      const { bytes, errors } = await exportBinderToPdf(state.binder, exportSettings);
      setErrors(errors);
      downloadPdf(bytes);
      // A completed export still counts even if some placements failed to
      // load — the rest of the PDF is usually still usable once cut out.
      recordExportTally();
    } finally {
      setExporting(false);
    }
  }

  const hasAnyPlacement = state.binder.pages.some((p) => p.placements.length > 0);

  const widthMm =
    exportSettings.pageSize === 'Custom'
      ? exportSettings.customWidthMm
      : mmFromPt(PAGE_SIZES_PT[exportSettings.pageSize].w);
  const heightMm =
    exportSettings.pageSize === 'Custom'
      ? exportSettings.customHeightMm
      : mmFromPt(PAGE_SIZES_PT[exportSettings.pageSize].h);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-base font-semibold">Export to PDF</h3>

      <Accordion defaultValue={['page-layout', 'guides']} multiple>
        <AccordionItem value="page-layout">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <LayoutGrid className="size-4" />
              Page Layout
            </span>
          </AccordionTrigger>
          <AccordionContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Page size</Label>
              <Select
                value={exportSettings.pageSize}
                onValueChange={(v) => update({ pageSize: v as PageSize })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((size) => (
                    <SelectItem key={size} value={size}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <div className="flex flex-col gap-1.5 flex-1">
                <Label htmlFor="page-width">Page width (mm)</Label>
                <Input
                  id="page-width"
                  type="number"
                  min={10}
                  step={1}
                  disabled={exportSettings.pageSize !== 'Custom'}
                  value={Math.round(widthMm)}
                  onChange={(e) => update({ pageSize: 'Custom', customWidthMm: Number(e.target.value) })}
                />
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <Label htmlFor="page-height">Page height (mm)</Label>
                <Input
                  id="page-height"
                  type="number"
                  min={10}
                  step={1}
                  disabled={exportSettings.pageSize !== 'Custom'}
                  value={Math.round(heightMm)}
                  onChange={(e) => update({ pageSize: 'Custom', customHeightMm: Number(e.target.value) })}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              {mmToIn(widthMm).toFixed(2)}in × {mmToIn(heightMm).toFixed(2)}in
            </p>

            <Button variant="outline" className="w-full" onClick={swapOrientation}>
              Swap orientation
            </Button>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="positioning">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <Move className="size-4" />
              Card Positioning
            </span>
          </AccordionTrigger>
          <AccordionContent className="flex flex-col gap-4">
            <div>
              <Label className="mb-1.5 block">Card spacing (mm)</Label>
              <div className="flex items-end gap-2">
                <div className="flex flex-col gap-1.5 flex-1">
                  <Label htmlFor="spacing-x" className="text-xs font-normal text-muted-foreground">
                    Horizontal
                  </Label>
                  <Input
                    id="spacing-x"
                    type="number"
                    min={0}
                    step={0.5}
                    value={exportSettings.cardSpacingXMm}
                    onChange={(e) => update({ cardSpacingXMm: Number(e.target.value) })}
                  />
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  <Label htmlFor="spacing-y" className="text-xs font-normal text-muted-foreground">
                    Vertical
                  </Label>
                  <Input
                    id="spacing-y"
                    type="number"
                    min={0}
                    step={0.5}
                    value={exportSettings.cardSpacingYMm}
                    onChange={(e) => update({ cardSpacingYMm: Number(e.target.value) })}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Extra gap between printed cards, useful for cutting with scissors instead of a
                straightedge.
              </p>
            </div>

            <div>
              <Label className="mb-1.5 block">Position adjustment (mm)</Label>
              <div className="flex items-end gap-2">
                <div className="flex flex-col gap-1.5 flex-1">
                  <Label htmlFor="offset-x" className="text-xs font-normal text-muted-foreground">
                    Horizontal
                  </Label>
                  <Input
                    id="offset-x"
                    type="number"
                    step={0.5}
                    value={exportSettings.cardOffsetXMm}
                    onChange={(e) => update({ cardOffsetXMm: Number(e.target.value) })}
                  />
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  <Label htmlFor="offset-y" className="text-xs font-normal text-muted-foreground">
                    Vertical
                  </Label>
                  <Input
                    id="offset-y"
                    type="number"
                    step={0.5}
                    value={exportSettings.cardOffsetYMm}
                    onChange={(e) => update({ cardOffsetYMm: Number(e.target.value) })}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Nudges the whole grid on the page — compensate for a printer that consistently
                shifts output off-center.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="guides">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <Scan className="size-4" />
              Guides
            </span>
          </AccordionTrigger>
          <AccordionContent className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="card-edge"
                checked={exportSettings.showCardEdge}
                onCheckedChange={(checked) => update({ showCardEdge: checked })}
              />
              <Label htmlFor="card-edge" className="font-normal">
                Show cut-line crosshairs
              </Label>
            </div>
            {exportSettings.showCardEdge && (
              <div className="flex items-center gap-2">
                <Label htmlFor="card-edge-color" className="font-normal">
                  Card edge color
                </Label>
                <input
                  id="card-edge-color"
                  type="color"
                  className="h-8 w-12 rounded border border-input bg-transparent"
                  value={exportSettings.cardEdgeColor}
                  onChange={(e) => update({ cardEdgeColor: e.target.value })}
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <Switch
                id="page-guides"
                checked={exportSettings.showPageGuides}
                onCheckedChange={(checked) => update({ showPageGuides: checked })}
              />
              <Label htmlFor="page-guides" className="font-normal">
                Show paper cutter guides
              </Label>
            </div>
            {exportSettings.showPageGuides && (
              <div className="flex items-center gap-2">
                <Label htmlFor="page-guide-color" className="font-normal">
                  Guide color
                </Label>
                <input
                  id="page-guide-color"
                  type="color"
                  className="h-8 w-12 rounded border border-input bg-transparent"
                  value={exportSettings.pageGuideColor}
                  onChange={(e) => update({ pageGuideColor: e.target.value })}
                />
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="flex items-center gap-2">
        <Switch
          id="include-pokemon-cards"
          checked={exportSettings.includePokemonCards}
          onCheckedChange={(checked) => update({ includePokemonCards: checked })}
        />
        <Label htmlFor="include-pokemon-cards" className="font-normal">
          Include Pokémon cards
        </Label>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Cards added via card Search are excluded from the PDF when off — only your own uploaded
        images print, and Search cards no longer take up a print slot.
      </p>

      <p className="text-xs text-muted-foreground">
        Cards print at exact standard size (2.5" × 3.5"). Empty binder slots are never printed —
        images flow tightly onto the page, skipping gaps.
      </p>

      {oversizedNote && <p className="text-sm text-amber-600 dark:text-amber-400">{oversizedNote}</p>}

      {errors.length > 0 && (
        <div className="text-sm text-destructive">
          {errors.length} image(s) failed to load and were skipped:
          <ul className="list-disc list-inside">
            {errors.map((e) => (
              <li key={e.placementId}>{e.message}</li>
            ))}
          </ul>
        </div>
      )}

      <Button className="w-full" disabled={exporting || !hasAnyPlacement} onClick={handleExport}>
        {exporting && <Loader2 className="size-4 animate-spin" />}
        {exporting ? 'Exporting…' : 'Export PDF'}
      </Button>
      {!hasAnyPlacement && (
        <p className="text-xs text-muted-foreground text-center">Add at least one image to export.</p>
      )}
    </div>
  );
}

function mmFromPt(pt: number) {
  return (pt / 72) * MM_PER_INCH;
}
