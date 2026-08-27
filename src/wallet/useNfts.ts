import { useCallback, useEffect, useState } from 'react';

import { fetchNfts, type NftItem } from './history';
import type { NetworkConfig } from './networks';

export interface NftsState {
  items: NftItem[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

interface Loaded {
  key: string;
  items: NftItem[];
  error: string | null;
}

const EMPTY: NftItem[] = [];

/**
 * Loads the NFTs held by `address`.
 *
 * Keyed by network+address like the balance and history hooks, so one
 * account's collectibles are never shown under another's.
 */
export function useNfts(network: NetworkConfig, address: string | null): NftsState {
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

    fetchNfts(network, address)
      .then((items) => {
        if (!cancelled) setLoaded({ key, items, error: null });
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setLoaded({
          key,
          items: [],
          error: caught instanceof Error ? caught.message : 'Could not load your NFTs.',
        });
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });

    return () => {
      cancelled = true;
    };
    // Keyed on the chain id rather than the config object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network.id, address, key, nonce]);

  const current = loaded !== null && loaded.key === key ? loaded : null;

  return {
    items: current?.items ?? EMPTY,
    error: current?.error ?? null,
    loading: key !== null && (current === null || refreshing),
    refresh,
  };
}
