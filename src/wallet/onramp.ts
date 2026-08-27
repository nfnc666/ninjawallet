import type { NetworkConfig } from './networks';

/**
 * Fiat on- and off-ramp handoff.
 *
 * Buying and selling with a card means KYC, custody of fiat, and a money
 * transmitter licence — none of which a self-custody wallet does itself. What
 * this build does is hand off to a regulated provider with the destination
 * address filled in, which is what wallets that do not run their own ramp all
 * do. Nothing here touches your keys.
 */
const ONRAMP_URL = process.env.EXPO_PUBLIC_ONRAMP_URL ?? 'https://global.transak.com';

export type RampSide = 'buy' | 'sell';

export interface RampAvailability {
  available: boolean;
  reason?: string;
}

/** Ramps only serve real networks; a testnet has nothing to buy. */
export function rampAvailability(network: NetworkConfig): RampAvailability {
  if (!network.isMainnet) {
    return {
      available: false,
      reason:
        `${network.name} coins are free from a faucet and have no market, so there is nothing ` +
        'to buy or sell. Switch to Ethereum in Settings.',
    };
  }
  return { available: true };
}

/**
 * Builds the provider URL for a ramp session.
 *
 * The address is passed so funds land in this wallet rather than being pasted
 * by hand — a mistyped address at this step is unrecoverable.
 */
export function buildRampUrl(params: {
  side: RampSide;
  network: NetworkConfig;
  address: string;
  fiatCurrency?: string;
}): string {
  const { side, network, address, fiatCurrency = 'EUR' } = params;

  const query = new URLSearchParams({
    productsAvailed: side === 'buy' ? 'BUY' : 'SELL',
    cryptoCurrencyCode: network.currencySymbol,
    network: 'ethereum',
    walletAddress: address,
    fiatCurrency,
    disableWalletAddressForm: 'true',
  });

  return `${ONRAMP_URL}/?${query}`;
}
