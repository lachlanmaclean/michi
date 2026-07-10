import { useAppState } from '@/state/AppStateContext';
import { GRID_PRESETS, type CardPreset } from '@/types/binder';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const PRESET_LABELS: Record<Exclude<CardPreset, 'custom'>, string> = {
  '3x3': '3×3 (9-pocket)',
  '4x2': '4×2 (8-pocket)',
  '2x2': '2×2 (jumbo)',
};

export function GridConfigPanel() {
  const { state, dispatch } = useAppState();
  const page = state.binder.pages.find((p) => p.id === state.activePageId)!;
  const { rows, cols, preset } = page.gridConfig;
  const def = state.binder.defaultGridConfig;
  const setAsDefault = def.rows === rows && def.cols === cols && def.preset === preset;

  function applyPreset(p: Exclude<CardPreset, 'custom'>) {
    const { rows, cols } = GRID_PRESETS[p];
    dispatch({
      type: 'SET_GRID_CONFIG',
      pageId: page.id,
      gridConfig: { rows, cols, preset: p },
      setAsDefault,
    });
  }

  function setRows(value: number) {
    if (!Number.isFinite(value) || value < 1) return;
    dispatch({
      type: 'SET_GRID_CONFIG',
      pageId: page.id,
      gridConfig: { rows: value, cols, preset: 'custom' },
      setAsDefault,
    });
  }

  function setCols(value: number) {
    if (!Number.isFinite(value) || value < 1) return;
    dispatch({
      type: 'SET_GRID_CONFIG',
      pageId: page.id,
      gridConfig: { rows, cols: value, preset: 'custom' },
      setAsDefault,
    });
  }

  return (
    <Card className="border-0 shadow-none bg-transparent gap-4">
      <CardHeader className="px-0">
        <CardTitle className="text-base">Grid Layout</CardTitle>
      </CardHeader>
      <CardContent className="px-0 flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-2">
          {(Object.keys(PRESET_LABELS) as Exclude<CardPreset, 'custom'>[]).map((p) => (
            <Button
              key={p}
              variant={preset === p ? 'default' : 'outline'}
              className="justify-start"
              onClick={() => applyPreset(p)}
            >
              {PRESET_LABELS[p]}
            </Button>
          ))}
        </div>

        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rows">Rows</Label>
            <Input
              id="rows"
              type="number"
              min={1}
              max={12}
              className="w-16"
              value={rows}
              onChange={(e) => setRows(Number(e.target.value))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cols">Cols</Label>
            <Input
              id="cols"
              type="number"
              min={1}
              max={12}
              className="w-16"
              value={cols}
              onChange={(e) => setCols(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="set-default"
            checked={setAsDefault}
            onCheckedChange={(checked) =>
              dispatch({
                type: 'SET_GRID_CONFIG',
                pageId: page.id,
                gridConfig: page.gridConfig,
                setAsDefault: checked,
              })
            }
          />
          <Label htmlFor="set-default" className="text-sm font-normal text-muted-foreground">
            Set as default for new pages
          </Label>
        </div>

        <p className="text-xs text-muted-foreground">
          Changing the grid clears this page's placements.
        </p>
      </CardContent>
    </Card>
  );
}
