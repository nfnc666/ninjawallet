import { CURRENCIES, findCurrency, isCurrencyCode, searchCurrencies } from '../currency';
import { fetchMarkets, searchMarkets, topGainers, type MarketCoin } from '../markets';

const originalFetch = global.fetch;

function mockFetch(response: { ok?: boolean; status?: number; body?: unknown }) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: response.ok ?? true,
    status: response.status ?? 200,
    json: async () => response.body,
  }) as unknown as typeof fetch;
}

function raw(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bitcoin',
    symbol: 'btc',
    name: 'Bitcoin',
    current_price: 91000,
    price_change_percentage_24h: 2.5,
    market_cap_rank: 1,
    ...overrides,
  };
}

function coin(id: string, change: number | null, symbol = id.toUpperCase()): MarketCoin {
  return {
    id,
    symbol,
    name: id,
    price: 1,
    changePercent24h: change,
    marketCapRank: null,
  };
}

afterEach(() => {
  global.fetch = originalFetch;
});

describe('currency list', () => {
  it('offers the three currencies the design shows', () => {
    expect(CURRENCIES.map((c) => c.label)).toEqual(['USD', 'EUR', 'GBP']);
  });

  it('recognises its own codes and rejects others', () => {
    expect(isCurrencyCode('eur')).toBe(true);
    expect(isCurrencyCode('jpy')).toBe(false);
    expect(isCurrencyCode('')).toBe(false);
  });

  it('looks a currency up by code', () => {
    expect(findCurrency('gbp')?.symbol).toBe('£');
    expect(findCurrency('nope')).toBeUndefined();
  });

  it('searches by code and by name, case-insensitively', () => {
    expect(searchCurrencies('eur').map((c) => c.code)).toEqual(['eur']);
    expect(searchCurrencies('pound').map((c) => c.code)).toEqual(['gbp']);
    expect(searchCurrencies('DOLLAR').map((c) => c.code)).toEqual(['usd']);
  });

  it('returns everything for an empty query', () => {
    expect(searchCurrencies('   ')).toHaveLength(3);
  });
});

describe('fetchMarkets', () => {
  it('reads a coin, upper-casing the symbol', async () => {
    mockFetch({ body: [raw()] });
    const [entry] = await fetchMarkets();
    expect(entry).toMatchObject({
      id: 'bitcoin',
      symbol: 'BTC',
      name: 'Bitcoin',
      price: 91000,
      changePercent24h: 2.5,
    });
  });

  it('asks for the selected currency', async () => {
    mockFetch({ body: [] });
    await fetchMarkets('gbp');
    expect(String((global.fetch as jest.Mock).mock.calls[0][0])).toContain('vs_currency=gbp');
  });

  it('drops a coin with no readable price rather than showing it at zero', async () => {
    // This list is what someone scans before deciding what to buy.
    mockFetch({ body: [raw(), raw({ id: 'broken', current_price: null })] });
    await expect(fetchMarkets()).resolves.toHaveLength(1);
  });

  it('keeps a missing 24h change as null, not as zero', async () => {
    mockFetch({ body: [raw({ price_change_percentage_24h: null })] });
    const [entry] = await fetchMarkets();
    expect(entry?.changePercent24h).toBeNull();
  });

  it('copes with a body that is not an array', async () => {
    mockFetch({ body: { error: 'nope' } });
    await expect(fetchMarkets()).resolves.toEqual([]);
  });

  it('reports rate limiting distinctly', async () => {
    mockFetch({ ok: false, status: 429 });
    await expect(fetchMarkets()).rejects.toThrow(/rate limiting/i);
  });

  it('reports other failures with their status', async () => {
    mockFetch({ ok: false, status: 503 });
    await expect(fetchMarkets()).rejects.toThrow(/503/);
  });
});

describe('topGainers', () => {
  it('sorts the biggest risers first', () => {
    const sorted = topGainers([coin('a', 1), coin('b', 9), coin('c', 5)]);
    expect(sorted.map((c) => c.id)).toEqual(['b', 'c', 'a']);
  });

  it('puts coins with no reported change last, not at zero', () => {
    // Unknown and flat are different things; sorting them as 0% would rank an
    // unreported coin above every faller.
    const sorted = topGainers([coin('unknown', null), coin('faller', -5), coin('riser', 3)]);
    expect(sorted.map((c) => c.id)).toEqual(['riser', 'faller', 'unknown']);
  });

  it('honours the limit', () => {
    expect(topGainers([coin('a', 1), coin('b', 2), coin('c', 3)], 2)).toHaveLength(2);
  });

  it('does not mutate its input', () => {
    const input = [coin('a', 1), coin('b', 9)];
    topGainers(input);
    expect(input.map((c) => c.id)).toEqual(['a', 'b']);
  });
});

describe('searchMarkets', () => {
  const coins = [coin('bitcoin', 1, 'BTC'), coin('ethereum', 2, 'ETH')];

  it('matches on name', () => {
    expect(searchMarkets(coins, 'ether').map((c) => c.id)).toEqual(['ethereum']);
  });

  it('matches on symbol, case-insensitively', () => {
    expect(searchMarkets(coins, 'BTC').map((c) => c.id)).toEqual(['bitcoin']);
  });

  it('returns everything for a blank query', () => {
    expect(searchMarkets(coins, '  ')).toHaveLength(2);
  });
});
