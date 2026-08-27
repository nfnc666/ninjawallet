import { useCallback, useEffect, useState } from 'react';

import { fetchPrices } from './prices';

export interface PricesState {
  /** USD spot prices by symbol. A symbol is absent when it has no price. */
  prices: Record<string, number>;
  loading: boolean;
  /** Set when the price service could not be reached. Never swallowed. */
  error: string | null;
  refresh: () => void;
}

interface Loaded {
  /** Which symbol set this result belongs to. */
  key: string;
  prices: Record<string, number>;
  error: string | null;
}

const EMPTY: Record<string, number> = {};

/**
 * Loads USD prices for `symbols`.
 *
 * Prices are a display convenience, so a failure degrades to "no fiat shown"
 * rather than blocking the screen — but the error is surfaced, because a
 * missing price must not be mistaken for a price of zero.
 *
 * The result is keyed by the symbol set, so prices fetched for one set are
 * never shown against another.
 */
export function usePrices(symbols: string[]): PricesState {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [nonce, setNonce] = useState(0);

  // Sorted so a re-render with an equivalent array does not refetch.
  const key = [...symbols].sort().join(',');

  const refresh = useCallback(() => {
    setRefreshing(true);
    setNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    if (key === '') return;

    let cancelled = false;

    fetchPrices(key.split(','))
      .then((prices) => {
        if (!cancelled) setLoaded({ key, prices, error: null });
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setLoaded({
          key,
          prices: {},
          error: caught instanceof Error ? caught.message : 'Could not load prices.',
        });
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [key, nonce]);

  const current = loaded !== null && loaded.key === key ? loaded : null;

  return {
    prices: current?.prices ?? EMPTY,
    error: current?.error ?? null,
    loading: key !== '' && (current === null || refreshing),
    refresh,
  };
}
