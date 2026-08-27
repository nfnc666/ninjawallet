import {
  fiatValue,
  formatUsd,
  fetchPrices,
  isPriceable,
  networkHasFiatValue,
  PriceUnavailableError,
} from '../prices';
import { NETWORKS } from '../networks';

const originalFetch = global.fetch;

function mockFetch(response: { ok?: boolean; status?: number; body?: unknown }) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: response.ok ?? true,
    status: response.status ?? 200,
    json: async () => response.body,
  }) as unknown as typeof fetch;
}

afterEach(() => {
  global.fetch = originalFetch;
});

describe('isPriceable', () => {
  it('knows the traded assets', () => {
    expect(isPriceable('ETH')).toBe(true);
    expect(isPriceable('BTC')).toBe(true);
  });

  it('refuses testnet coins, which have no market', () => {
    expect(isPriceable('SepoliaETH')).toBe(false);
  });
});

describe('networkHasFiatValue', () => {
  it('is false on a testnet, so no dollar figure is ever invented', () => {
    expect(networkHasFiatValue(NETWORKS.sepolia)).toBe(false);
  });

  it('is true on mainnet', () => {
    expect(networkHasFiatValue(NETWORKS.ethereum)).toBe(true);
  });
});

describe('fetchPrices', () => {
  it('maps symbols onto the returned prices', async () => {
    mockFetch({ body: { ethereum: { usd: 3200.5 }, bitcoin: { usd: 91000 } } });
    await expect(fetchPrices(['ETH', 'BTC'])).resolves.toEqual({ ETH: 3200.5, BTC: 91000 });
  });

  it('does not call the service when nothing in the list is traded', async () => {
    mockFetch({ body: {} });
    await expect(fetchPrices(['SepoliaETH'])).resolves.toEqual({});
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('omits a symbol the service did not price, rather than defaulting it to zero', async () => {
    // A missing price and a price of zero mean very different things to
    // someone deciding whether to send funds.
    mockFetch({ body: { ethereum: { usd: 3200 }, bitcoin: {} } });
    const prices = await fetchPrices(['ETH', 'BTC']);
    expect(prices).toEqual({ ETH: 3200 });
    expect('BTC' in prices).toBe(false);
  });

  it('rejects a non-finite price instead of letting NaN reach a balance line', async () => {
    mockFetch({ body: { ethereum: { usd: Number.NaN } } });
    await expect(fetchPrices(['ETH'])).resolves.toEqual({});
  });

  it('rejects a negative price', async () => {
    mockFetch({ body: { ethereum: { usd: -5 } } });
    await expect(fetchPrices(['ETH'])).resolves.toEqual({});
  });

  it('reports rate limiting distinctly, since it clears on its own', async () => {
    mockFetch({ ok: false, status: 429 });
    await expect(fetchPrices(['ETH'])).rejects.toThrow(PriceUnavailableError);
    await expect(fetchPrices(['ETH'])).rejects.toThrow(/rate limiting/i);
  });

  it('reports other failures with their status', async () => {
    mockFetch({ ok: false, status: 503 });
    await expect(fetchPrices(['ETH'])).rejects.toThrow(/503/);
  });
});

describe('fiatValue', () => {
  const ETH = 18;

  it('values a whole coin at the spot price', () => {
    expect(fiatValue(10n ** 18n, ETH, 3200)).toBeCloseTo(3200, 6);
  });

  it('values a fraction proportionally', () => {
    expect(fiatValue(5n * 10n ** 17n, ETH, 3200)).toBeCloseTo(1600, 6);
  });

  it('values a zero balance at zero', () => {
    expect(fiatValue(0n, ETH, 3200)).toBe(0);
  });

  it('keeps precision on a balance far beyond float range', () => {
    // 1,234,567 ETH — the token amount must not be floated before scaling.
    const amount = 1_234_567n * 10n ** 18n;
    expect(fiatValue(amount, ETH, 2)).toBeCloseTo(2_469_134, 0);
  });

  it('returns zero for a nonsensical price rather than NaN', () => {
    expect(fiatValue(10n ** 18n, ETH, Number.NaN)).toBe(0);
    expect(fiatValue(10n ** 18n, ETH, -1)).toBe(0);
  });
});

describe('formatUsd', () => {
  it('shows two decimals for ordinary amounts', () => {
    expect(formatUsd(3200.456)).toBe('$3,200.46');
  });

  it('shows more precision for sub-dollar amounts, which would round to $0.00', () => {
    expect(formatUsd(0.0123)).toBe('$0.0123');
  });

  it('formats zero plainly', () => {
    expect(formatUsd(0)).toBe('$0.00');
  });

  it('shows a dash rather than NaN', () => {
    expect(formatUsd(Number.NaN)).toBe('—');
  });
});
