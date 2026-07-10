import type { AppState } from '../types/binder';
import { SCHEMA_VERSION, createDefaultState } from './defaultState';

const STORAGE_KEY = 'michi:appState:v1';
const SIZE_WARNING_BYTES = 4 * 1024 * 1024;

export function loadInitialState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw) as AppState;
    if (parsed.schemaVersion !== SCHEMA_VERSION) return createDefaultState();
    return parsed;
  } catch {
    return createDefaultState();
  }
}

export function saveState(state: AppState): { warning?: string } {
  try {
    const json = JSON.stringify(state);
    if (json.length > SIZE_WARNING_BYTES) {
      localStorage.setItem(STORAGE_KEY, json);
      return { warning: 'Storage is getting large — consider using image URLs instead of uploads to avoid hitting browser storage limits.' };
    }
    localStorage.setItem(STORAGE_KEY, json);
    return {};
  } catch (e) {
    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
      return { warning: 'Storage limit reached — try removing some uploaded images or use image URLs instead.' };
    }
    return { warning: 'Failed to save your changes locally.' };
  }
}

export function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return ((...args: any[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}
