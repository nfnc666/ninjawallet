import type { NetworkConfig } from './networks';

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
  /** Real address derived from the seed; balance and sending not implemented. */
  | 'receive-only';

export interface WalletAsset {
  symbol: string;
  name: string;
  support: AssetSupport;
  /** Copy shown in place of a balance for assets we cannot price or query. */
  note?: string;
}

/** The asset list for a given network. */
export function assetsForNetwork(network: NetworkConfig): WalletAsset[] {
  return [
    {
      symbol: network.currencySymbol,
      name: network.isMainnet ? 'Ethereum' : 'Sepolia Ether',
      support: 'full',
    },
    {
      symbol: 'BTC',
      name: 'Bitcoin',
      support: 'receive-only',
      note: 'Receive only',
    },
  ];
}
