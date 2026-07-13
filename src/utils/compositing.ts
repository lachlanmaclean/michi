import type { BinderPage } from '../types/binder';
import { rectContains } from './grid';

/**
 * For every cell in the page's grid, determines which placement "wins" —
 * i.e. the placement on the topmost layer that covers that cell. Used by
 * both on-screen rendering and PDF export so they always agree on what's
 * visible.
 */
export function computeWinnerMap(page: BinderPage): Map<string, string> {
  const layerOrder = new Map(page.layers.map((l, i) => [l.id, i]));
  const winner = new Map<string, string>();

  for (let row = 0; row < page.gridConfig.rows; row++) {
    for (let col = 0; col < page.gridConfig.cols; col++) {
      let best: { placementId: string; z: number } | null = null;
      for (const p of page.placements) {
        if (!rectContains(p.rect, row, col)) continue;
        const z = layerOrder.get(p.layerId) ?? -1;
        if (!best || z > best.z) best = { placementId: p.id, z };
      }
      if (best) winner.set(`${row},${col}`, best.placementId);
    }
  }

  return winner;
}
