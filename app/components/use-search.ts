'use client';

import { useEffect, useState } from 'react';
import type { SearchHit } from '../../lib/search';
import type { ContentType, Difficulty } from '../../lib/types';

export function useSearch(query: string, filters: { tag?: string; type?: ContentType; difficulty?: Difficulty } = {}) {
  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resultKey, setResultKey] = useState('');
  const { tag, type, difficulty } = filters;
  const key = JSON.stringify([query.trim(), tag, type, difficulty]);
  useEffect(() => {
    const controller = new AbortController();
    if (query.trim().length < 2) return;
    const timer = setTimeout(async () => {
      setLoading(true); setError('');
      const params = new URLSearchParams({ q: query.trim(), limit: '30' });
      if (tag) params.set('tag', tag);
      if (type) params.set('type', type);
      if (difficulty) params.set('difficulty', difficulty);
      try {
        const response = await fetch('/api/search?' + params, { signal: controller.signal });
        if (!response.ok) throw Error('Search is unavailable. Please try again.');
        const data = await response.json() as { results: SearchHit[] };
        if (!controller.signal.aborted) { setResults(data.results); setResultKey(key); }
      } catch (error) {
        if (!controller.signal.aborted) { setError(error instanceof Error ? error.message : 'Search failed.'); setResults([]); }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, tag, type, difficulty, key]);
  return { results: query.trim().length >= 2 && resultKey === key ? results : [], loading: query.trim().length >= 2 && (loading || resultKey !== key) && !error, error };
}
