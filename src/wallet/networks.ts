/**
 * Chains the wallet can talk to.
 *
 * Sepolia is the default on purpose: this wallet has not been audited, and a
 * bug on a testnet costs nothing. Mainnet is reachable but the UI makes the
 * user turn it on deliberately (Settings → Network) and warns while it is on.
 */
export interface NetworkConfig {
  readonly id: NetworkId;
  readonly chainId: number;
  readonly name: string;
  readonly currencySymbol: string;
  readonly currencyDecimals: number;
  readonly rpcUrl: string;
  readonly explorerTxUrl: (hash: string) => string;
  readonly explorerAddressUrl: (address: string) => string;
  /**
   * Blockscout API base for transaction history. Blockscout is used rather
   * than Etherscan because its API needs no key, so history works out of the
   * box instead of behind a signup.
   */
  readonly historyApiUrl: string;
  /** False for testnets — drives the "test funds only" messaging. */
  readonly isMainnet: boolean;
  /** Where users can get free test coins, when there is such a place. */
  readonly faucetUrl?: string;
}

export type NetworkId = 'sepolia' | 'ethereum';

/**
 * RPC endpoints. Both default to public nodes so the app runs with no setup;
 * point them at your own node with EXPO_PUBLIC_SEPOLIA_RPC_URL /
 * EXPO_PUBLIC_ETHEREUM_RPC_URL, which is what you want for anything real —
 * a public node sees every address you query.
 */
const SEPOLIA_RPC =
  process.env.EXPO_PUBLIC_SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com';
const ETHEREUM_RPC =
  process.env.EXPO_PUBLIC_ETHEREUM_RPC_URL ?? 'https://ethereum-rpc.publicnode.com';

export const NETWORKS: Record<NetworkId, NetworkConfig> = {
  sepolia: {
    id: 'sepolia',
    chainId: 11155111,
    name: 'Sepolia Testnet',
    currencySymbol: 'SepoliaETH',
    currencyDecimals: 18,
    rpcUrl: SEPOLIA_RPC,
    explorerTxUrl: (hash) => `https://sepolia.etherscan.io/tx/${hash}`,
    explorerAddressUrl: (address) => `https://sepolia.etherscan.io/address/${address}`,
    historyApiUrl: 'https://eth-sepolia.blockscout.com/api/v2',
    isMainnet: false,
    faucetUrl: 'https://sepoliafaucet.com',
  },
  ethereum: {
    id: 'ethereum',
    chainId: 1,
    name: 'Ethereum',
    currencySymbol: 'ETH',
    currencyDecimals: 18,
    rpcUrl: ETHEREUM_RPC,
    explorerTxUrl: (hash) => `https://etherscan.io/tx/${hash}`,
    explorerAddressUrl: (address) => `https://etherscan.io/address/${address}`,
    historyApiUrl: 'https://eth.blockscout.com/api/v2',
    isMainnet: true,
  },
};

export const DEFAULT_NETWORK_ID: NetworkId = 'sepolia';
