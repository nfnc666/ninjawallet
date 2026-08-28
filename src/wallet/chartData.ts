import { DEFAULT_CURRENCY, type CurrencyCode } from './currency';
import { marketIdFor, PriceUnavailableError } from './prices';

/**
 * Historical price series for the coin-detail chart.
 *
 * Same keyless service as the spot prices. Set EXPO_PUBLIC_CHART_API_URL to
 * point at your own instance; `{id}` in the value is replaced with the coin's
 * market identifier.
 */
const CHART_API_URL =
  process.env.EXPO_PUBLIC_CHART_API_URL ??
  'https://api.coingecko.com/api/v3/coins/{id}/market_chart';
const PRICE_API_KEY = process.env.EXPO_PUBLIC_PRICE_API_KEY;

/** The ranges the design's pills offer (figma 140:1495). */
export const CHART_RANGES = [
  { id: '24H', days: 1 },
  { id: '7D', days: 7 },
  { id: '1M', days: 30 },
  { id: '3M', days: 90 },
  { id: '6M', days: 180 },
  { id: '1Y', days: 365 },
] as const;

export type ChartRangeId = (typeof CHART_RANGES)[number]['id'];
export const DEFAULT_RANGE: ChartRangeId = '24H';

export interface PricePoint {
  timestamp: number;
  price: number;
}

export interface PriceSeries {
  points: PricePoint[];
  low: number;
  high: number;
  /** Change from the first point to the last, in percent. */
  changePercent: number;
}

function daysFor(range: ChartRangeId): number {
  return CHART_RANGES.find((entry) => entry.id === range)?.days ?? 1;
}

/**
 * Normalises the service's `[timestamp, price]` pairs into a plottable series.
 *
 * A sample that is not a finite number is dropped rather than plotted as zero.
 * One bad point would drag the line to the axis and make the shape of the
 * chart — the only thing anyone reads off it — a lie.
 */
export function toSeries(raw: unknown[]): PriceSeries {
  const points: PricePoint[] = [];

  for (const entry of raw) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const [timestamp, price] = entry as [unknown, unknown];
    if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) continue;
    if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) continue;
    points.push({ timestamp, price });
  }

  points.sort((a, b) => a.timestamp - b.timestamp);

  if (points.length === 0) {
    return { points, low: 0, high: 0, changePercent: 0 };
  }

  let low = Number.POSITIVE_INFINITY;
  let high = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    if (point.price < low) low = point.price;
    if (point.price > high) high = point.price;
  }

  const first = points[0] as PricePoint;
  const last = points[points.length - 1] as PricePoint;
  const changePercent = first.price === 0 ? 0 : ((last.price - first.price) / first.price) * 100;

  return { points, low, high, changePercent };
}

/** Fetches a price series for `symbol` over `range`. */
export async function fetchPriceSeries(
  symbol: string,
  range: ChartRangeId = DEFAULT_RANGE,
  currency: CurrencyCode = DEFAULT_CURRENCY,
): Promise<PriceSeries> {
  const id = marketIdFor(symbol);
  if (id === null) {
    throw new PriceUnavailableError(`${symbol} does not trade, so it has no price history.`);
  }

  const query = new URLSearchParams({ vs_currency: currency, days: String(daysFor(range)) });
  const headers: Record<string, string> = { accept: 'application/json' };
  if (PRICE_API_KEY) headers['x-cg-pro-api-key'] = PRICE_API_KEY;

  let response: Response;
  try {
    response = await fetch(`${CHART_API_URL.replace('{id}', id)}?${query}`, { headers });
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

  const body = (await response.json()) as { prices?: unknown } | null;
  return toSeries(Array.isArray(body?.prices) ? body.prices : []);
}

/**
 * Maps the series onto an SVG box.
 *
 * The y-range is fitted to the data rather than anchored at zero: against a
 * zero baseline a price line is a flat streak with no readable shape. The high
 * and low are labelled on the chart, so the range it actually covers is never
 * left implicit.
 *
 * A flat series would divide by zero; it is centred vertically instead.
 */
export function toPolyline(
  points: PricePoint[],
  width: number,
  height: number,
  low: number,
  high: number,
): { x: number; y: number }[] {
  if (points.length === 0 || width <= 0 || height <= 0) return [];
  if (points.length === 1) return [{ x: width / 2, y: height / 2 }];

  const span = high - low;
  const first = points[0] as PricePoint;
  const last = points[points.length - 1] as PricePoint;
  const timeSpan = last.timestamp - first.timestamp;

  return points.map((point, index) => ({
    x:
      timeSpan === 0
        ? (index / (points.length - 1)) * width
        : ((point.timestamp - first.timestamp) / timeSpan) * width,
    y: span === 0 ? height / 2 : height - ((point.price - low) / span) * height,
  }));
}
