import { DEFAULT_CURRENCY, type CurrencyCode } from './currency';
import { PriceUnavailableError } from './prices';

/**
 * Market list for the design's "top gainers" screen.
 *
 * Same keyless service as the spot prices, different endpoint. Set
 * EXPO_PUBLIC_MARKETS_API_URL to point at your own instance or a proxy.
 */
const MARKETS_API_URL =
  process.env.EXPO_PUBLIC_MARKETS_API_URL ?? 'https://api.coingecko.com/api/v3/coins/markets';
const PRICE_API_KEY = process.env.EXPO_PUBLIC_PRICE_API_KEY;

export interface MarketCoin {
  id: string;
  symbol: string;
  name: string;
  price: number;
  /** 24-hour change in percent. Null when the service did not report one. */
  changePercent24h: number | null;
  marketCapRank: number | null;
}

interface RawMarket {
  id?: unknown;
  symbol?: unknown;
  name?: unknown;
  current_price?: unknown;
  price_change_percentage_24h?: unknown;
  market_cap_rank?: unknown;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Fetches the top coins by market cap, with their 24-hour move.
 *
 * A coin whose price cannot be read is dropped rather than shown at zero: this
 * list is what someone scans before deciding what to buy.
 */
export async function fetchMarkets(
  currency: CurrencyCode = DEFAULT_CURRENCY,
  limit = 50,
): Promise<MarketCoin[]> {
  const query = new URLSearchParams({
    vs_currency: currency,
    order: 'market_cap_desc',
    per_page: String(Math.min(limit, 250)),
    page: '1',
    price_change_percentage: '24h',
  });

  const headers: Record<string, string> = { accept: 'application/json' };
  if (PRICE_API_KEY) headers['x-cg-pro-api-key'] = PRICE_API_KEY;

  let response: Response;
  try {
    response = await fetch(`${MARKETS_API_URL}?${query}`, { headers });
  } catch (caught) {
    throw new PriceUnavailableError(
      caught instanceof Error ? caught.message : 'Could not reach the price service.',
    );
  }

  if (response.status === 429) {
    throw new PriceUnavailableError('Price service is rate limiting. Try again shortly.');
  }
  if (!response.ok) {
    throw new PriceUnavailableError(`Price service returned ${response.status}.`);
  }

  const body = (await response.json()) as RawMarket[] | null;
  if (!Array.isArray(body)) return [];

  return body
    .map((entry): MarketCoin | null => {
      const id = typeof entry.id === 'string' ? entry.id : null;
      const symbol = typeof entry.symbol === 'string' ? entry.symbol.toUpperCase() : null;
      const price = finiteNumber(entry.current_price);
      if (id === null || symbol === null || price === null) return null;

      return {
        id,
        symbol,
        name: typeof entry.name === 'string' && entry.name !== '' ? entry.name : symbol,
        price,
        changePercent24h: finiteNumber(entry.price_change_percentage_24h),
        marketCapRank: finiteNumber(entry.market_cap_rank),
      };
    })
    .filter((coin): coin is MarketCoin => coin !== null);
}

/**
 * Biggest 24-hour risers first.
 *
 * Coins with no reported change sort last rather than being treated as 0% —
 * unknown and flat are different things.
 */
export function topGainers(coins: MarketCoin[], limit = 20): MarketCoin[] {
  return [...coins]
    .sort((a, b) => {
      if (a.changePercent24h === null) return b.changePercent24h === null ? 0 : 1;
      if (b.changePercent24h === null) return -1;
      return b.changePercent24h - a.changePercent24h;
    })
    .slice(0, limit);
}

/** Filters by symbol or name for the design's search field. */
export function searchMarkets(coins: MarketCoin[], query: string): MarketCoin[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return coins;
  return coins.filter(
    (coin) =>
      coin.symbol.toLowerCase().includes(needle) || coin.name.toLowerCase().includes(needle),
  );
}
