import { useCallback, useEffect, useState } from 'react';

import { getBalance } from './chain';
import type { NetworkConfig } from './networks';

export interface BalanceState {
  /** Balance in wei, or null before the first successful load. */
  value: bigint | null;
  loading: boolean;
  /** Set when the node could not be reached — surfaced, never swallowed. */
  error: string | null;
  refresh: () => void;
}

interface Loaded {
  /** Which network+address this result belongs to. */
  key: string;
  value: bigint | null;
  error: string | null;
}

/**
 * Reads the native-coin balance for `address` on `network`.
 *
 * The result is keyed by network+address rather than merely stored, so
 * switching account or network can never show the previous balance under the
 * new address — it reads as "loading" until the new figure arrives.
 */
export function useBalance(network: NetworkConfig, address: string | null): BalanceState {
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

    getBalance(network.id, address)
      .then((value) => {
        if (!cancelled) setLoaded({ key, value, error: null });
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setLoaded({
          key,
          value: null,
          error: caught instanceof Error ? caught.message : 'Could not reach the network.',
        });
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [network.id, address, key, nonce]);

  // Anything loaded for a different key belongs to another account — ignore it.
  const current = loaded !== null && loaded.key === key ? loaded : null;

  return {
    value: current?.value ?? null,
    error: current?.error ?? null,
    loading: key !== null && (current === null || refreshing),
    refresh,
  };
}
