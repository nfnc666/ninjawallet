import type { NetworkId } from './networks';

/**
 * The pseudo-address aggregators use to mean "the chain's native coin" rather
 * than an ERC-20 contract.
 */
export const NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

export interface Token {
  symbol: string;
  name: string;
  /** Contract address, or {@link NATIVE_TOKEN_ADDRESS} for the native coin. */
  address: string;
  decimals: number;
}

export function isNativeToken(token: Token): boolean {
  return token.address.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase();
}

/**
 * Swappable tokens per chain.
 *
 * Mainnet only. Aggregators do not serve Sepolia — there is no real liquidity
 * to route through — so the swap screen says so rather than offering a form
 * that can only fail. Addresses are the canonical mainnet deployments.
 */
const TOKENS: Record<NetworkId, Token[]> = {
  ethereum: [
    { symbol: 'ETH', name: 'Ethereum', address: NATIVE_TOKEN_ADDRESS, decimals: 18 },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      decimals: 6,
    },
    {
      symbol: 'USDT',
      name: 'Tether',
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      decimals: 6,
    },
    {
      symbol: 'DAI',
      name: 'Dai',
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      decimals: 18,
    },
    {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      decimals: 18,
    },
  ],
  sepolia: [],
};

export function tokensForNetwork(networkId: NetworkId): Token[] {
  return TOKENS[networkId];
}

/** True when this chain has a swap route at all. */
export function networkSupportsSwap(networkId: NetworkId): boolean {
  return TOKENS[networkId].length > 0;
}

export function findToken(networkId: NetworkId, symbol: string): Token | undefined {
  return TOKENS[networkId].find((token) => token.symbol === symbol);
}
