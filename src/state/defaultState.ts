import { v4 as uuid } from 'uuid';
import type { AppState, BinderPage } from '../types/binder';

export const SCHEMA_VERSION = 10;

export function createDefaultPage(): BinderPage {
  const layer = { id: uuid(), name: 'Layer 1' };
  return {
    id: uuid(),
    gridConfig: { rows: 3, cols: 3, preset: '3x3' },
    layers: [layer],
    activeLayerId: layer.id,
    placements: [],
  };
}

export function createDefaultState(): AppState {
  const page = createDefaultPage();
  return {
    binder: {
      id: uuid(),
      name: 'My Binder',
      defaultGridConfig: { rows: 3, cols: 3, preset: '3x3' },
      pages: [page],
    },
    activePageId: page.id,
    searchSetId: null,
    exportSettings: {
      pageSize: 'Letter',
      customWidthMm: 216,
      customHeightMm: 279,
      cardEdgeColor: '#22c55e',
      showCardEdge: true,
      pageGuideColor: '#000000',
      showPageGuides: true,
      cardSpacingXMm: 0,
      cardSpacingYMm: 0,
      cardOffsetXMm: 0,
      cardOffsetYMm: 0,
      includePokemonCards: true,
    },
    schemaVersion: SCHEMA_VERSION,
  };
}
