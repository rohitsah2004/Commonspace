'use client';

import { useSyncExternalStore } from 'react';
import { CONTENT_TYPES, type ContentType } from './types';

export type SavedItem = { id: string; slug: string; title: string; type: ContentType; savedAt: number };
export const SAVED_KEY = 'commonplace-saved-v1';
const EMPTY: SavedItem[] = [];
const listeners = new Set<() => void>();
let previous: string | null | undefined;
let snapshot: SavedItem[] = EMPTY;

export function validateSaved(value: unknown): SavedItem[] {
  if (!Array.isArray(value) || value.length > 500) throw Error('Saved lists may contain at most 500 items.');
  const ids = new Set<string>();
  return value.map(v => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw Error('Invalid saved item.');
    const item = v as Record<string, unknown>;
    if (Object.keys(item).some(k => !['id', 'slug', 'title', 'type', 'savedAt'].includes(k))
      || typeof item.id !== 'string' || !/^[A-Za-z0-9-]{1,100}$/.test(item.id)
      || typeof item.slug !== 'string' || !/^[a-z0-9-]{1,160}$/.test(item.slug)
      || typeof item.title !== 'string' || !item.title.trim() || item.title.length > 200
      || !CONTENT_TYPES.includes(item.type as ContentType)
      || typeof item.savedAt !== 'number' || !Number.isSafeInteger(item.savedAt)
      || item.savedAt <= 0 || item.savedAt > Date.now() + 86400000 || ids.has(item.id)) throw Error('Invalid saved item.');
    ids.add(item.id);
    return { id: item.id, slug: item.slug, title: item.title, type: item.type as ContentType, savedAt: item.savedAt };
  });
}

export function readSaved(storage: Pick<Storage, 'getItem'>): SavedItem[] {
  try { const text = storage.getItem(SAVED_KEY); if (!text || text.length > 300000) return EMPTY; return validateSaved(JSON.parse(text)); }
  catch { return EMPTY; }
}
function getSnapshot() {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = window.localStorage.getItem(SAVED_KEY);
    if (raw !== previous) { previous = raw; snapshot = readSaved(window.localStorage); }
    return snapshot;
  } catch { previous = undefined; snapshot = EMPTY; return EMPTY; }
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  const handler = (event: StorageEvent) => { if (event.key === SAVED_KEY || event.key === null) listener(); };
  window.addEventListener('storage', handler);
  return () => { listeners.delete(listener); window.removeEventListener('storage', handler); };
}
export function replaceSaved(items: SavedItem[]): boolean {
  try {
    const normalized = validateSaved(items);
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(normalized));
    previous = undefined;
    listeners.forEach(listener => listener());
    return true;
  } catch { return false; }
}
export function toggleSaved(item: Omit<SavedItem, 'savedAt'>): boolean {
  const current = getSnapshot();
  if (current.some(v => v.id === item.id)) return replaceSaved(current.filter(v => v.id !== item.id));
  if (current.length >= 500) return false;
  return replaceSaved([{ id: item.id, slug: item.slug, title: item.title, type: item.type, savedAt: Date.now() }, ...current]);
}
export function useSaved() {
  const items = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  return {
    items,
    isSaved: (id: string) => items.some(item => item.id === id),
    toggle: toggleSaved,
    remove: (id: string) => replaceSaved(getSnapshot().filter(item => item.id !== id)),
    replace: replaceSaved,
  };
}
