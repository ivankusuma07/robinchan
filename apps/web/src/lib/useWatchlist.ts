'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useWallet } from '@/components/providers/WalletProvider';
import { API_BASE } from '@/lib/api';

export type WatchlistState = {
  symbols: string[];
  loaded: boolean;
  has: (symbol: string) => boolean;
  /** Adds or removes `symbol`, saving the whole set to the server right away. */
  toggle: (symbol: string) => void;
};

/**
 * Per-user watchlist (brief §5), backed by `GET`/`PUT /api/user/watchlist`.
 * One source per signed-in session — the Heat page's star toggle and its
 * "Watchlist" filter both read this, so they can never disagree about
 * what's saved.
 */
export function useWatchlist(): WatchlistState {
  const { status } = useWallet();
  const signedIn = status === 'signed-in';
  const [symbols, setSymbols] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Guards a slower PUT response from clobbering a faster, later one.
  const saveTick = useRef(0);

  useEffect(() => {
    if (!signedIn) {
      setSymbols([]);
      setLoaded(false);
      return;
    }
    let cancelled = false;
    fetch(`${API_BASE}/api/user/watchlist`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { data?: { symbols?: string[] } } | null) => {
        if (cancelled) return;
        setSymbols(body?.data?.symbols ?? []);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  const toggle = useCallback((symbol: string) => {
    setSymbols((prev) => {
      const next = prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol];
      const tick = ++saveTick.current;
      void fetch(`${API_BASE}/api/user/watchlist`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ symbols: next }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((body: { data?: { symbols?: string[] } } | null) => {
          // A slower save landing after a newer one must not win.
          if (tick !== saveTick.current || !body?.data?.symbols) return;
          setSymbols(body.data.symbols);
        })
        .catch(() => undefined);
      return next;
    });
  }, []);

  const has = useCallback((symbol: string) => symbols.includes(symbol), [symbols]);

  return { symbols, loaded, has, toggle };
}
