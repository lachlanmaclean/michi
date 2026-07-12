import { createContext, useContext, useEffect, useReducer, useState, type ReactNode } from 'react';
import { v4 as uuid } from 'uuid';
import type { AppState, BinderPage, CellRect, CropTransform, GridConfig, ImagePlacement } from '../types/binder';
import { loadInitialState, saveState, debounce } from './persistence';
import { createDefaultPage } from './defaultState';
import { isCombinablePair } from '../utils/grid';

type Action =
  | { type: 'SET_GRID_CONFIG'; pageId: string; gridConfig: GridConfig; setAsDefault?: boolean }
  | { type: 'ADD_PAGE' }
  | { type: 'REMOVE_PAGE'; pageId: string }
  | { type: 'REORDER_PAGES'; pageIds: string[] }
  | { type: 'SET_ACTIVE_PAGE'; pageId: string }
  | { type: 'ASSIGN_IMAGE'; pageId: string; placement: ImagePlacement }
  | { type: 'REMOVE_IMAGE'; pageId: string; placementId: string }
  | { type: 'RESIZE_PLACEMENT'; pageId: string; placementId: string; rect: CellRect }
  | { type: 'UPDATE_CROP'; pageId: string; placementId: string; crop: CropTransform }
  | { type: 'UPDATE_EXPORT_SETTINGS'; settings: Partial<AppState['exportSettings']> }
  | { type: 'SET_SEARCH_SET'; setId: string | null }
  | { type: 'SET_COMBINED'; pageId: string; placementId: string; combined: boolean };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_GRID_CONFIG': {
      const pages = state.binder.pages.map((p) =>
        p.id === action.pageId ? { ...p, gridConfig: action.gridConfig, placements: [] } : p
      );
      return {
        ...state,
        binder: {
          ...state.binder,
          pages,
          defaultGridConfig: action.setAsDefault ? action.gridConfig : state.binder.defaultGridConfig,
        },
      };
    }
    case 'ADD_PAGE': {
      const page: BinderPage = {
        id: uuid(),
        gridConfig: state.binder.defaultGridConfig,
        placements: [],
      };
      return {
        ...state,
        binder: { ...state.binder, pages: [...state.binder.pages, page] },
        activePageId: page.id,
      };
    }
    case 'REMOVE_PAGE': {
      const pages = state.binder.pages.filter((p) => p.id !== action.pageId);
      const nextPages = pages.length > 0 ? pages : [createDefaultPage()];
      const activePageId =
        state.activePageId === action.pageId ? nextPages[0].id : state.activePageId;
      return { ...state, binder: { ...state.binder, pages: nextPages }, activePageId };
    }
    case 'REORDER_PAGES': {
      const byId = new Map(state.binder.pages.map((p) => [p.id, p]));
      const pages = action.pageIds.map((id) => byId.get(id)!).filter(Boolean);
      return { ...state, binder: { ...state.binder, pages } };
    }
    case 'SET_ACTIVE_PAGE':
      return { ...state, activePageId: action.pageId };
    case 'ASSIGN_IMAGE': {
      const pages = state.binder.pages.map((p) => {
        if (p.id !== action.pageId) return p;
        const placements = p.placements.filter((pl) => pl.id !== action.placement.id);
        return { ...p, placements: [...placements, action.placement] };
      });
      return { ...state, binder: { ...state.binder, pages } };
    }
    case 'REMOVE_IMAGE': {
      const pages = state.binder.pages.map((p) =>
        p.id !== action.pageId
          ? p
          : { ...p, placements: p.placements.filter((pl) => pl.id !== action.placementId) }
      );
      return { ...state, binder: { ...state.binder, pages } };
    }
    case 'RESIZE_PLACEMENT': {
      const pages = state.binder.pages.map((p) =>
        p.id !== action.pageId
          ? p
          : {
              ...p,
              placements: p.placements.map((pl) =>
                pl.id === action.placementId
                  ? // A resize that stops being an exact 1x2/2x1 pair can no
                    // longer draw as one combined seamless tile.
                    { ...pl, rect: action.rect, combined: pl.combined && isCombinablePair(action.rect) }
                  : pl
              ),
            }
      );
      return { ...state, binder: { ...state.binder, pages } };
    }
    case 'UPDATE_CROP': {
      const pages = state.binder.pages.map((p) =>
        p.id !== action.pageId
          ? p
          : {
              ...p,
              placements: p.placements.map((pl) =>
                pl.id === action.placementId ? { ...pl, crop: action.crop } : pl
              ),
            }
      );
      return { ...state, binder: { ...state.binder, pages } };
    }
    case 'UPDATE_EXPORT_SETTINGS':
      return { ...state, exportSettings: { ...state.exportSettings, ...action.settings } };
    case 'SET_SEARCH_SET':
      return { ...state, searchSetId: action.setId };
    case 'SET_COMBINED': {
      const pages = state.binder.pages.map((p) =>
        p.id !== action.pageId
          ? p
          : {
              ...p,
              placements: p.placements.map((pl) =>
                pl.id === action.placementId ? { ...pl, combined: action.combined } : pl
              ),
            }
      );
      return { ...state, binder: { ...state.binder, pages } };
    }
    default:
      return state;
  }
}

interface Ctx {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  storageWarning: string | null;
}

const AppStateCtx = createContext<Ctx | null>(null);

const debouncedSave = debounce((state: AppState, onWarning: (w: string | null) => void) => {
  const { warning } = saveState(state);
  onWarning(warning ?? null);
}, 500);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  useEffect(() => {
    debouncedSave(state, setStorageWarning);
  }, [state]);

  return (
    <AppStateCtx.Provider value={{ state, dispatch, storageWarning }}>
      {children}
    </AppStateCtx.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateCtx);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}
