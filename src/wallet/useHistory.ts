import { useCallback, useEffect, useState } from 'react';

import { fetchHistory, type HistoryEntry } from './history';
import type { NetworkConfig } from './networks';

export interface HistoryState {
  entries: HistoryEntry[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

interface Loaded {
  /** Which network+address this result belongs to. */
  key: string;
  entries: HistoryEntry[];
  error: string | null;
}

const EMPTY: HistoryEntry[] = [];

/**
 * Loads recent transactions for `address` on `network`.
 *
 * Keyed by network+address like {@link useBalance}, so switching account can
 * never show the previous account's transactions under the new one.
 */
export function useHistory(network: NetworkConfig, address: string | null): HistoryState {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [nonce, setNonce] = useState(0);

  const key = address === null ? null : `${network.id}:${address}`;

  const refresh = useCallback(() => {
    setRefreshing(true);
    setNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    if (address === null || key === null) return;

    let cancelled = false;

    fetchHistory(network, address)
      .then((entries) => {
        if (!cancelled) setLoaded({ key, entries, error: null });
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setLoaded({
          key,
          entries: [],
          error: caught instanceof Error ? caught.message : 'Could not load history.',
        });
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });

    return () => {
      cancelled = true;
    };
    // `network` is a stable config object keyed by id; depending on the id
    // avoids refetching when the object identity changes but the chain has not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network.id, address, key, nonce]);

  const current = loaded !== null && loaded.key === key ? loaded : null;

  return {
    entries: current?.entries ?? EMPTY,
    error: current?.error ?? null,
    loading: key !== null && (current === null || refreshing),
    refresh,
  };
}
