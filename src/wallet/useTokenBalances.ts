import { useCallback, useEffect, useState } from 'react';

import { getTokenBalances } from './erc20';
import type { NetworkConfig } from './networks';
import { isNativeToken, tokensForNetwork, type Token } from './tokens';

export interface TokenBalancesState {
  /** Balance per symbol, in the token's smallest unit. Absent means unread. */
  balances: Record<string, bigint>;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

interface Loaded {
  /** Which network+address these balances belong to. */
  key: string;
  balances: Record<string, bigint>;
  error: string | null;
}

const EMPTY: Record<string, bigint> = {};

/** The ERC-20s this build knows about on `network`. */
export function tokenAssets(network: NetworkConfig): Token[] {
  return tokensForNetwork(network.id).filter((token) => !isNativeToken(token));
}

/**
 * Reads ERC-20 balances for `address` on `network`.
 *
 * Keyed by network+address like {@link useBalance}: token balances are chain
 * specific, and showing mainnet USDC under a testnet account would be a plain
 * lie about what the account holds.
 */
export function useTokenBalances(
  network: NetworkConfig,
  address: string | null,
): TokenBalancesState {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [nonce, setNonce] = useState(0);

  const tokens = tokenAssets(network);
  // Sepolia has no token list, so there is nothing to read and nothing to wait
  // for — the empty result is derived rather than written into state.
  const hasTokens = tokens.length > 0;
  const key = address === null || !hasTokens ? null : `${network.id}:${address}`;

  const refresh = useCallback(() => {
    setRefreshing(true);
    setNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    if (address === null || key === null) return;

    let cancelled = false;

    getTokenBalances(network.id, tokens, address)
      .then((balances) => {
        if (!cancelled) setLoaded({ key, balances, error: null });
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setLoaded({
          key,
          balances: EMPTY,
          error: caught instanceof Error ? caught.message : 'Could not read token balances.',
        });
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });

    return () => {
      cancelled = true;
    };
    // The token list is derived from the network id, so it does not need to be
    // a dependency of its own — including it would refetch on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network.id, address, key, nonce]);

  const current = loaded !== null && loaded.key === key ? loaded : null;

  return {
    balances: current?.balances ?? EMPTY,
    error: current?.error ?? null,
    loading: key !== null && (current === null || refreshing),
    refresh,
  };
}
