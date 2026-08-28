import {
  fetchHistory,
  fetchTokenTransfers,
  formatWhen,
  HistoryUnavailableError,
} from '../history';
import { NETWORKS } from '../networks';

const SELF = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94';
const OTHER = '0x6Fac4D18c912343BF86fa7049364Dd4E424Ab9C0';
const originalFetch = global.fetch;

function mockFetch(response: { ok?: boolean; status?: number; body?: unknown }) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: response.ok ?? true,
    status: response.status ?? 200,
    json: async () => response.body,
  }) as unknown as typeof fetch;
}

function tx(overrides: Record<string, unknown> = {}) {
  return {
    hash: '0xabc',
    value: '1000000000000000000',
    timestamp: '2026-08-01T12:00:00.000000Z',
    status: 'ok',
    from: { hash: OTHER },
    to: { hash: SELF },
    fee: { value: '21000000000000' },
    ...overrides,
  };
}

afterEach(() => {
  global.fetch = originalFetch;
});

describe('fetchHistory', () => {
  it('reads an incoming transfer', async () => {
    mockFetch({ body: { items: [tx()] } });
    const [entry] = await fetchHistory(NETWORKS.sepolia, SELF);

    expect(entry).toMatchObject({
      hash: '0xabc',
      direction: 'in',
      value: 10n ** 18n,
      counterparty: OTHER,
      succeeded: true,
      fee: 21_000_000_000_000n,
    });
  });

  it('reads an outgoing transfer and names the recipient as counterparty', async () => {
    mockFetch({ body: { items: [tx({ from: { hash: SELF }, to: { hash: OTHER } })] } });
    const [entry] = await fetchHistory(NETWORKS.sepolia, SELF);
    expect(entry?.direction).toBe('out');
    expect(entry?.counterparty).toBe(OTHER);
  });

  it('recognises a transfer to yourself', async () => {
    mockFetch({ body: { items: [tx({ from: { hash: SELF }, to: { hash: SELF } })] } });
    const [entry] = await fetchHistory(NETWORKS.sepolia, SELF);
    expect(entry?.direction).toBe('self');
  });

  it('matches the address regardless of checksum casing', async () => {
    mockFetch({ body: { items: [tx({ from: { hash: SELF.toLowerCase() }, to: { hash: OTHER } })] } });
    const [entry] = await fetchHistory(NETWORKS.sepolia, SELF.toUpperCase().replace('0X', '0x'));
    expect(entry?.direction).toBe('out');
  });

  it('marks a reverted transaction as failed rather than hiding it', async () => {
    // It still cost a fee, so it belongs in the list — but its amount never moved.
    mockFetch({ body: { items: [tx({ status: 'error' })] } });
    const [entry] = await fetchHistory(NETWORKS.sepolia, SELF);
    expect(entry?.succeeded).toBe(false);
  });

  it('skips entries with no usable hash or value instead of rendering blanks', async () => {
    mockFetch({
      body: { items: [tx(), tx({ hash: null }), tx({ value: 'not-a-number' })] },
    });
    await expect(fetchHistory(NETWORKS.sepolia, SELF)).resolves.toHaveLength(1);
  });

  it('survives a malformed address in the payload', async () => {
    mockFetch({ body: { items: [tx({ from: { hash: 'garbage' } })] } });
    const [entry] = await fetchHistory(NETWORKS.sepolia, SELF);
    expect(entry?.counterparty).toBeNull();
  });

  it('treats an unparsable timestamp as pending rather than an invalid date', async () => {
    mockFetch({ body: { items: [tx({ timestamp: 'whenever' })] } });
    const [entry] = await fetchHistory(NETWORKS.sepolia, SELF);
    expect(entry?.timestamp).toBeNull();
  });

  it('returns nothing for an address the explorer has never seen', async () => {
    mockFetch({ ok: false, status: 404 });
    await expect(fetchHistory(NETWORKS.sepolia, SELF)).resolves.toEqual([]);
  });

  it('reports rate limiting distinctly, since it clears on its own', async () => {
    mockFetch({ ok: false, status: 429 });
    await expect(fetchHistory(NETWORKS.sepolia, SELF)).rejects.toThrow(/rate limiting/i);
  });

  it('reports a server failure rather than pretending the history is empty', async () => {
    mockFetch({ ok: false, status: 500 });
    await expect(fetchHistory(NETWORKS.sepolia, SELF)).rejects.toThrow(HistoryUnavailableError);
  });

  it('reports a network failure rather than throwing something unreadable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
    await expect(fetchHistory(NETWORKS.sepolia, SELF)).rejects.toThrow(/offline/);
  });

  it('copes with a body that has no items array', async () => {
    mockFetch({ body: {} });
    await expect(fetchHistory(NETWORKS.sepolia, SELF)).resolves.toEqual([]);
  });

  it('honours the requested limit', async () => {
    mockFetch({ body: { items: Array.from({ length: 40 }, () => tx()) } });
    await expect(fetchHistory(NETWORKS.sepolia, SELF, 5)).resolves.toHaveLength(5);
  });
});

describe('formatWhen', () => {
  it('says pending when there is no timestamp', () => {
    expect(formatWhen(null)).toBe('Pending');
  });

  it('reads as just now within the minute', () => {
    expect(formatWhen(new Date(Date.now() - 10_000))).toBe('Just now');
  });

  it('counts minutes, then hours, then days', () => {
    expect(formatWhen(new Date(Date.now() - 5 * 60_000))).toBe('5 min ago');
    expect(formatWhen(new Date(Date.now() - 3 * 3_600_000))).toBe('3 h ago');
    expect(formatWhen(new Date(Date.now() - 2 * 86_400_000))).toBe('2 d ago');
  });

  it('falls back to a date beyond a week', () => {
    expect(formatWhen(new Date(Date.now() - 30 * 86_400_000))).toMatch(/\d+ \w+/);
  });
});

describe('fetchTokenTransfers', () => {
  const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
  const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F';

  const transfer = (over: Record<string, unknown> = {}) => ({
    tx_hash: '0xfeed',
    timestamp: '2026-01-02T03:04:05.000000Z',
    from: { hash: OTHER },
    to: { hash: SELF },
    total: { value: '2500000' },
    token: { address: USDC },
    ...over,
  });

  it('reads the token amount, not the transaction value', () => {
    // A token movement is a log inside a transaction; the transaction's own
    // value is usually zero.
    mockFetch({ body: { items: [transfer()] } });
    return expect(fetchTokenTransfers(NETWORKS.ethereum, SELF, USDC)).resolves.toMatchObject([
      { value: 2_500_000n, direction: 'in' },
    ]);
  });

  it('marks a transfer we sent as outgoing, with the recipient', async () => {
    mockFetch({
      body: { items: [transfer({ from: { hash: SELF }, to: { hash: OTHER } })] },
    });
    const [entry] = await fetchTokenTransfers(NETWORKS.ethereum, SELF, USDC);
    expect(entry?.direction).toBe('out');
    expect(entry?.counterparty).toBe(OTHER);
  });

  it('drops a row for a different token than the one asked for', async () => {
    // The explorer decides what it returns; a DAI row under the USDC ticker
    // would misstate the amount by twelve decimal places.
    mockFetch({ body: { items: [transfer({ token: { address: DAI } }), transfer()] } });
    expect(await fetchTokenTransfers(NETWORKS.ethereum, SELF, USDC)).toHaveLength(1);
  });

  it('charges no fee to the transfer itself', async () => {
    // The fee belongs to the transaction, not to this log.
    const [entry] = await (async () => {
      mockFetch({ body: { items: [transfer()] } });
      return fetchTokenTransfers(NETWORKS.ethereum, SELF, USDC);
    })();
    expect(entry?.fee).toBeNull();
  });

  it('asks the explorer only for ERC-20 transfers of that contract', async () => {
    mockFetch({ body: { items: [] } });
    await fetchTokenTransfers(NETWORKS.ethereum, SELF, USDC);
    const url = String((global.fetch as jest.Mock).mock.calls[0][0]);
    expect(url).toContain('token-transfers');
    expect(url).toContain('type=ERC-20');
    expect(url).toContain(encodeURIComponent(USDC));
  });

  it('reads an address the explorer never saw as no transfers', async () => {
    mockFetch({ ok: false, status: 404 });
    expect(await fetchTokenTransfers(NETWORKS.ethereum, SELF, USDC)).toEqual([]);
  });

  it('surfaces a failure rather than reading as an empty history', async () => {
    mockFetch({ ok: false, status: 500 });
    await expect(fetchTokenTransfers(NETWORKS.ethereum, SELF, USDC)).rejects.toBeInstanceOf(
      HistoryUnavailableError,
    );
  });
});
