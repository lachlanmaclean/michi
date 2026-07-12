import { v4 as uuid } from 'uuid';
import type { AppState, BinderPage } from '../types/binder';

export const SCHEMA_VERSION = 7;

export function createDefaultPage(): BinderPage {
  return {
    id: uuid(),
    gridConfig: { rows: 3, cols: 3, preset: '3x3' },
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
      cropMarkColor: '#000000',
      showCropMarks: true,
      cardEdgeColor: '#22c55e',
      showCardEdge: true,
      showSafeArea: false,
      cardSpacingXMm: 0,
      cardSpacingYMm: 0,
      cardOffsetXMm: 0,
      cardOffsetYMm: 0,
      includePokemonCards: true,
    },
    schemaVersion: SCHEMA_VERSION,
  };
}
