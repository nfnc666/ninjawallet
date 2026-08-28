import { BITCOIN_UNIT } from './bitcoin';
import { unitOf, type CoinUnit } from './chain';
import type { NetworkConfig } from './networks';
import { isNativeToken, tokensForNetwork, type Token } from './tokens';

/**
 * What the wallet can actually do per asset.
 *
 * The Figma design shows a long coin list (BNB, ADA, SOL, PEPE, …). We only
 * list assets this build genuinely supports, because a row showing a balance we
 * cannot verify is worse than no row: people act on those numbers.
 */
export type AssetSupport =
  /** Real balance, real sending. */
  | 'full'
  /** Real address and a real balance read from the chain; sending not implemented. */
  | 'watch-only'
  /** Real address derived from the seed; balance and sending not implemented. */
  | 'receive-only';

export interface WalletAsset {
  symbol: string;
  name: string;
  support: AssetSupport;
  /** How the amount is scaled and displayed. */
  unit: CoinUnit;
  /** The ERC-20 behind this row, when it is one. */
  token?: Token;
  /** Copy shown in place of a balance for assets we cannot price or query. */
  note?: string;
}

/**
 * The asset list for a given network.
 *
 * The ERC-20s come from the same table the swap screen routes through, so a
 * token can never be listed here and be unswappable there, or vice versa.
 * Sepolia has no token entries — there are no canonical deployments to read —
 * so on a testnet the list is just the native coin and bitcoin.
 */
export function assetsForNetwork(network: NetworkConfig): WalletAsset[] {
  const tokens = tokensForNetwork(network.id)
    .filter((token) => !isNativeToken(token))
    .map((token): WalletAsset => ({
      symbol: token.symbol,
      name: token.name,
      support: 'full',
      unit: { symbol: token.symbol, decimals: token.decimals, precision: 6 },
      token,
    }));

  return [
    {
      symbol: network.currencySymbol,
      name: network.isMainnet ? 'Ethereum' : 'Sepolia Ether',
      support: 'full',
      unit: unitOf(network),
    },
    ...tokens,
    {
      symbol: 'BTC',
      name: 'Bitcoin',
      support: 'watch-only',
      unit: BITCOIN_UNIT,
      note: 'Receive only',
    },
  ];
}
