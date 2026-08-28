import { useCallback, useEffect, useState } from 'react';

import { fetchHistory, fetchTokenTransfers, type HistoryEntry } from './history';
import type { NetworkConfig } from './networks';
import type { Token } from './tokens';

export interface HistoryState {
  entries: HistoryEntry[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

interface Loaded {
  /** Which network+address+asset this result belongs to. */
  key: string;
  entries: HistoryEntry[];
  error: string | null;
}

const EMPTY: HistoryEntry[] = [];

/**
 * Loads recent transactions for `address` on `network`, or transfers of
 * `token` when one is given.
 *
 * Keyed by network+address+asset like {@link useBalance}, so switching account
 * or asset can never show one asset's movements under another's ticker — the
 * amounts would look plausible and be in the wrong denomination.
 */
export function useHistory(
  network: NetworkConfig,
  address: string | null,
  token?: Token,
): HistoryState {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [nonce, setNonce] = useState(0);

  const contract = token?.address ?? null;
  const key = address === null ? null : `${network.id}:${address}:${contract ?? 'native'}`;

  const refresh = useCallback(() => {
    setRefreshing(true);
    setNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    if (address === null || key === null) return;

    let cancelled = false;

    const load =
      contract === null
        ? fetchHistory(network, address)
        : fetchTokenTransfers(network, address, contract);

    load
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
  }, [network.id, address, contract, key, nonce]);

  const current = loaded !== null && loaded.key === key ? loaded : null;

  return {
    entries: current?.entries ?? EMPTY,
    error: current?.error ?? null,
    loading: key !== null && (current === null || refreshing),
    refresh,
  };
}
