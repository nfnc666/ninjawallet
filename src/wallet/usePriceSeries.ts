import { useCallback, useEffect, useState } from 'react';

import {
  DEFAULT_RANGE,
  fetchPriceSeries,
  type ChartRangeId,
  type PriceSeries,
} from './chartData';
import { DEFAULT_CURRENCY, type CurrencyCode } from './currency';

export interface PriceSeriesState {
  series: PriceSeries | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

interface Loaded {
  /** Which symbol, range and currency this series belongs to. */
  key: string;
  series: PriceSeries | null;
  error: string | null;
}

/**
 * Loads a price series for `symbol` over `range`.
 *
 * Keyed by symbol, range and currency together, so a series fetched for one
 * range can never be drawn under another range's label — the chart would look
 * plausible and be wrong, which is worse than showing nothing.
 */
export function usePriceSeries(
  symbol: string | null,
  range: ChartRangeId = DEFAULT_RANGE,
  currency: CurrencyCode = DEFAULT_CURRENCY,
): PriceSeriesState {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [nonce, setNonce] = useState(0);

  const key = symbol === null ? null : `${symbol}|${range}|${currency}`;

  const refresh = useCallback(() => {
    setRefreshing(true);
    setNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    if (symbol === null || key === null) return;

    let cancelled = false;

    fetchPriceSeries(symbol, range, currency)
      .then((series) => {
        if (!cancelled) setLoaded({ key, series, error: null });
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setLoaded({
          key,
          series: null,
          error: caught instanceof Error ? caught.message : 'Could not load price history.',
        });
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [symbol, range, currency, key, nonce]);

  const current = loaded !== null && loaded.key === key ? loaded : null;

  return {
    series: current?.series ?? null,
    error: current?.error ?? null,
    loading: key !== null && (current === null || refreshing),
    refresh,
  };
}
