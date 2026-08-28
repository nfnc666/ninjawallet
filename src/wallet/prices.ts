import { DEFAULT_CURRENCY, findCurrency, type CurrencyCode } from './currency';
import type { NetworkConfig } from './networks';

/**
 * Spot prices in USD.
 *
 * Defaults to CoinGecko's keyless public endpoint so the app works with no
 * setup. Set EXPO_PUBLIC_PRICE_API_URL and EXPO_PUBLIC_PRICE_API_KEY to point
 * at the Pro endpoint (or a proxy of your own) if you outgrow its rate limit —
 * the public one throttles hard and will start returning 429s under real use.
 */
const PRICE_API_URL =
  process.env.EXPO_PUBLIC_PRICE_API_URL ?? 'https://api.coingecko.com/api/v3/simple/price';
const PRICE_API_KEY = process.env.EXPO_PUBLIC_PRICE_API_KEY;

/**
 * Market identifiers per asset symbol.
 *
 * Testnet coins are absent on purpose. Sepolia ether has no market value, so
 * there is no honest number to show for it — see {@link isPriceable}.
 */
const COIN_IDS: Record<string, string> = {
  ETH: 'ethereum',
  BTC: 'bitcoin',
  USDC: 'usd-coin',
  USDT: 'tether',
  DAI: 'dai',
  WETH: 'weth',
};

/** Market identifier for an asset, or null when it does not trade. */
export function marketIdFor(symbol: string): string | null {
  return COIN_IDS[symbol] ?? null;
}

/** True when the asset trades and a fiat figure would mean something. */
export function isPriceable(symbol: string): boolean {
  return symbol in COIN_IDS;
}

/** True when this network's holdings have any fiat value at all. */
export function networkHasFiatValue(network: NetworkConfig): boolean {
  return network.isMainnet;
}

export class PriceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PriceUnavailableError';
  }
}

/**
 * Fetches USD spot prices for the given symbols.
 *
 * Unknown or untradeable symbols are simply absent from the result rather than
 * defaulted to zero — a missing price and a price of zero mean very different
 * things to someone deciding whether to send funds.
 */
export async function fetchPrices(
  symbols: string[],
  currency: CurrencyCode = DEFAULT_CURRENCY,
): Promise<Record<string, number>> {
  const wanted = symbols.filter(isPriceable);
  if (wanted.length === 0) return {};

  const ids = [...new Set(wanted.map((symbol) => COIN_IDS[symbol] as string))];
  const url = `${PRICE_API_URL}?ids=${ids.join(',')}&vs_currencies=${currency}`;

  const headers: Record<string, string> = { accept: 'application/json' };
  if (PRICE_API_KEY) headers['x-cg-pro-api-key'] = PRICE_API_KEY;

  const response = await fetch(url, { headers });
  if (response.status === 429) {
    throw new PriceUnavailableError('Price service is rate limiting. Try again shortly.');
  }
  if (!response.ok) {
    throw new PriceUnavailableError(`Price service returned ${response.status}.`);
  }

  const body = (await response.json()) as Record<string, Record<string, number> | undefined>;

  const prices: Record<string, number> = {};
  for (const symbol of wanted) {
    const id = COIN_IDS[symbol] as string;
    const value = body[id]?.[currency];
    // Reject anything non-finite rather than letting NaN reach a balance line.
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      prices[symbol] = value;
    }
  }
  return prices;
}

/**
 * Multiplies a wei amount by a USD price without going through a float for the
 * token amount, so large balances do not lose precision before scaling.
 */
export function fiatValue(amount: bigint, decimals: number, usdPrice: number): number {
  if (!Number.isFinite(usdPrice) || usdPrice < 0) return 0;

  // Keep six fractional digits of the token amount as an integer, then divide.
  const precision = 1_000_000n;
  const scaled = (amount * precision) / 10n ** BigInt(decimals);
  return (Number(scaled) / Number(precision)) * usdPrice;
}

export interface Holding {
  symbol: string;
  /** Amount held, in the asset's smallest unit. */
  amount: bigint;
  decimals: number;
}

export interface PortfolioTotal {
  /** Sum of every holding that could be priced. */
  total: number;
  /** Symbols held in a non-zero amount that no price was available for. */
  unpriced: string[];
}

/**
 * Adds up what the wallet holds.
 *
 * A holding with no price is left out of the sum and named in `unpriced`
 * instead. Treating a missing price as zero would quietly understate the
 * total, and a total that is wrong in a knowable way is worse than one that
 * says which part of itself is missing. A zero balance is never named: nothing
 * is missing from the sum when there is nothing to add.
 */
export function portfolioTotal(
  holdings: Holding[],
  prices: Record<string, number>,
): PortfolioTotal {
  let total = 0;
  const unpriced: string[] = [];

  for (const holding of holdings) {
    const price = prices[holding.symbol];
    if (price === undefined) {
      if (holding.amount > 0n) unpriced.push(holding.symbol);
      continue;
    }
    total += fiatValue(holding.amount, holding.decimals, price);
  }

  return { total, unpriced };
}

/**
 * Formats a fiat amount the way a balance line should read.
 *
 * Sub-unit amounts get more precision, because rounding 0.0123 to 0.01 hides
 * most of what is there.
 */
export function formatFiat(value: number, currency: CurrencyCode = DEFAULT_CURRENCY): string {
  if (!Number.isFinite(value)) return '—';
  const fractionDigits = value !== 0 && Math.abs(value) < 1 ? 4 : 2;
  const code = findCurrency(currency)?.label ?? 'USD';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: code,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/** The symbol whose price applies to a network's native coin, if any. */
export function nativePriceSymbol(network: NetworkConfig): string | null {
  return network.isMainnet ? network.currencySymbol : null;
}
