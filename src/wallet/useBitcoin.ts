import { useCallback, useEffect, useState } from 'react';

import { fetchBitcoinBalance, fetchBitcoinHistory, type BitcoinBalance } from './bitcoin';
import type { HistoryEntry } from './history';

export interface BitcoinAccountState {
  balance: BitcoinBalance | null;
  entries: HistoryEntry[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

interface Loaded {
  /** Which address, and whether history was asked for, this result belongs to. */
  key: string;
  balance: BitcoinBalance | null;
  entries: HistoryEntry[];
  error: string | null;
}

const EMPTY: HistoryEntry[] = [];

/**
 * Reads a bitcoin address: balance always, transactions when asked.
 *
 * Keyed by address like the Ethereum hooks, so a balance fetched for one
 * address is never shown under another. Balance and history are loaded
 * together and fail together: a screen showing a balance beside an empty
 * activity list, when the list merely failed to load, reads as "no
 * transactions" — which is a different claim from "could not load".
 */
export function useBitcoin(address: string | null, withHistory = false): BitcoinAccountState {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [nonce, setNonce] = useState(0);

  const key = address === null ? null : `${address}|${withHistory ? 'history' : 'balance'}`;

  const refresh = useCallback(() => {
    setRefreshing(true);
    setNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    if (address === null || key === null) return;

    let cancelled = false;

    Promise.all([
      fetchBitcoinBalance(address),
      withHistory ? fetchBitcoinHistory(address) : Promise.resolve(EMPTY),
    ])
      .then(([balance, entries]) => {
        if (!cancelled) setLoaded({ key, balance, entries, error: null });
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setLoaded({
          key,
          balance: null,
          entries: EMPTY,
          error: caught instanceof Error ? caught.message : 'Could not reach the bitcoin explorer.',
        });
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [address, withHistory, key, nonce]);

  const current = loaded !== null && loaded.key === key ? loaded : null;

  return {
    balance: current?.balance ?? null,
    entries: current?.entries ?? EMPTY,
    error: current?.error ?? null,
    loading: key !== null && (current === null || refreshing),
    refresh,
  };
}
