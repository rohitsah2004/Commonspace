'use client';

import { useEffect, useState } from 'react';
const KEY = 'commonplace-progress-v1';
type Progress = Record<string, string[]>;
function read(): Progress {
  try {
    const raw = localStorage.getItem(KEY); if (!raw || raw.length > 300000) return {};
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const result: Progress = {};
    for (const [key, ids] of Object.entries(value)) {
      if (!/^[A-Za-z0-9-]{1,100}$/.test(key) || !Array.isArray(ids) || ids.length > 500 || ids.some(id => typeof id !== 'string' || !/^[A-Za-z0-9-]{1,100}$/.test(id))) return {};
      result[key] = [...new Set(ids)];
    }
    return result;
  } catch { return {}; }
}
export function useProgress(collection: string) {
  const [state, setState] = useState<Progress>({});
  const [error, setError] = useState('');
  useEffect(() => {
    const update = () => setState(read());
    queueMicrotask(update); window.addEventListener('storage', update); window.addEventListener('commonplace-progress', update);
    return () => { window.removeEventListener('storage', update); window.removeEventListener('commonplace-progress', update); };
  }, []);
  return { done: state[collection] ?? [], error, toggle(id: string) {
    try {
      const current = read(); const ids = current[collection] ?? [];
      const value = { ...current, [collection]: ids.includes(id) ? ids.filter(v => v !== id) : [...ids, id].slice(0, 500) };
      localStorage.setItem(KEY, JSON.stringify(value)); window.dispatchEvent(new Event('commonplace-progress')); setError('');
    } catch { setError('Progress could not be saved. Browser storage may be blocked.'); }
  } };
}
