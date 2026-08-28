import {
  CHART_RANGES,
  DEFAULT_RANGE,
  fetchPriceSeries,
  toPolyline,
  toSeries,
} from '../chartData';

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

describe('ranges', () => {
  it('offers the pills the design shows', () => {
    expect(CHART_RANGES.map((entry) => entry.id)).toEqual(['24H', '7D', '1M', '3M', '6M', '1Y']);
  });

  it('defaults to the shortest range', () => {
    expect(DEFAULT_RANGE).toBe('24H');
  });
});

describe('toSeries', () => {
  it('reads timestamped prices', () => {
    const series = toSeries([
      [1000, 10],
      [2000, 20],
    ]);
    expect(series.points).toEqual([
      { timestamp: 1000, price: 10 },
      { timestamp: 2000, price: 20 },
    ]);
  });

  it('finds the low and the high', () => {
    const series = toSeries([
      [1, 5],
      [2, 15],
      [3, 9],
    ]);
    expect(series.low).toBe(5);
    expect(series.high).toBe(15);
  });

  it('reports the change from first to last, not from low to high', () => {
    const series = toSeries([
      [1, 100],
      [2, 200],
      [3, 150],
    ]);
    expect(series.changePercent).toBeCloseTo(50, 6);
  });

  it('reports a fall as negative', () => {
    expect(toSeries([[1, 200], [2, 100]]).changePercent).toBeCloseTo(-50, 6);
  });

  it('sorts points that arrive out of order', () => {
    const series = toSeries([
      [3, 30],
      [1, 10],
      [2, 20],
    ]);
    expect(series.points.map((point) => point.timestamp)).toEqual([1, 2, 3]);
  });

  it('drops a non-finite price rather than plotting it at zero', () => {
    // One bad sample would drag the line to the axis and make the chart's
    // shape — the only thing anyone reads off it — a lie.
    const series = toSeries([
      [1, 10],
      [2, Number.NaN],
      [3, 20],
    ]);
    expect(series.points).toHaveLength(2);
    expect(series.low).toBe(10);
  });

  it('drops malformed entries', () => {
    const series = toSeries([[1, 10], 'nope', [2], [3, 30], null]);
    expect(series.points).toHaveLength(2);
  });

  it('returns an empty, non-NaN series for no data', () => {
    expect(toSeries([])).toEqual({ points: [], low: 0, high: 0, changePercent: 0 });
  });

  it('does not divide by zero when the first price is zero', () => {
    expect(toSeries([[1, 0], [2, 5]]).changePercent).toBe(0);
  });
});

describe('toPolyline', () => {
  const points = [
    { timestamp: 0, price: 10 },
    { timestamp: 50, price: 20 },
    { timestamp: 100, price: 30 },
  ];

  it('spans the full width', () => {
    const line = toPolyline(points, 300, 100, 10, 30);
    expect(line[0]?.x).toBeCloseTo(0, 6);
    expect(line[line.length - 1]?.x).toBeCloseTo(300, 6);
  });

  it('puts the high at the top and the low at the bottom', () => {
    // SVG y grows downward, so the highest price must have the smallest y.
    const line = toPolyline(points, 300, 100, 10, 30);
    expect(line[0]?.y).toBeCloseTo(100, 6);
    expect(line[2]?.y).toBeCloseTo(0, 6);
  });

  it('places points by time, not by index', () => {
    // Unevenly sampled data must not be stretched into even spacing.
    const uneven = [
      { timestamp: 0, price: 1 },
      { timestamp: 90, price: 2 },
      { timestamp: 100, price: 3 },
    ];
    const line = toPolyline(uneven, 100, 10, 1, 3);
    expect(line[1]?.x).toBeCloseTo(90, 6);
  });

  it('centres a flat series instead of dividing by zero', () => {
    const flat = [
      { timestamp: 0, price: 5 },
      { timestamp: 10, price: 5 },
    ];
    const line = toPolyline(flat, 100, 80, 5, 5);
    expect(line.every((point) => point.y === 40)).toBe(true);
  });

  it('falls back to even spacing when every sample shares a timestamp', () => {
    const same = [
      { timestamp: 7, price: 1 },
      { timestamp: 7, price: 2 },
    ];
    const line = toPolyline(same, 100, 10, 1, 2);
    expect(line.map((point) => point.x)).toEqual([0, 100]);
  });

  it('returns nothing for an empty series or a zero-sized box', () => {
    expect(toPolyline([], 100, 100, 0, 1)).toEqual([]);
    expect(toPolyline(points, 0, 100, 10, 30)).toEqual([]);
  });

  it('centres a single point', () => {
    expect(toPolyline([points[0] as never], 100, 50, 10, 10)).toEqual([{ x: 50, y: 25 }]);
  });
});

describe('fetchPriceSeries', () => {
  it('reads a series from the service', async () => {
    mockFetch({ body: { prices: [[1000, 10], [2000, 12]] } });
    const series = await fetchPriceSeries('ETH');
    expect(series.points).toHaveLength(2);
  });

  it('asks for the right coin, range and currency', async () => {
    mockFetch({ body: { prices: [] } });
    await fetchPriceSeries('BTC', '1M', 'eur');
    const url = String((global.fetch as jest.Mock).mock.calls[0][0]);
    expect(url).toContain('/coins/bitcoin/');
    expect(url).toContain('days=30');
    expect(url).toContain('vs_currency=eur');
  });

  it('refuses an asset that does not trade', async () => {
    // Sepolia ether has no market, so it can have no history.
    await expect(fetchPriceSeries('SepoliaETH')).rejects.toThrow(/does not trade/i);
  });

  it('reports rate limiting distinctly', async () => {
    mockFetch({ ok: false, status: 429 });
    await expect(fetchPriceSeries('ETH')).rejects.toThrow(/rate limiting/i);
  });

  it('reports other failures with their status', async () => {
    mockFetch({ ok: false, status: 502 });
    await expect(fetchPriceSeries('ETH')).rejects.toThrow(/502/);
  });

  it('copes with a body that has no prices array', async () => {
    mockFetch({ body: {} });
    await expect(fetchPriceSeries('ETH')).resolves.toMatchObject({ points: [] });
  });
});
