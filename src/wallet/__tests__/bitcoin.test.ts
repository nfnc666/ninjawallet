import {
  BITCOIN_UNIT,
  bitcoinExplorer,
  fetchBitcoinBalance,
  fetchBitcoinHistory,
} from '../bitcoin';
import { formatAmount } from '../chain';

const ADDRESS = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
const OTHER = 'bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3';

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

describe('fetchBitcoinBalance', () => {
  it('reports funded minus spent', async () => {
    mockFetch({
      body: {
        chain_stats: { funded_txo_sum: 150_000, spent_txo_sum: 50_000, tx_count: 3 },
        mempool_stats: { funded_txo_sum: 0, spent_txo_sum: 0 },
      },
    });
    const balance = await fetchBitcoinBalance(ADDRESS);
    expect(balance.confirmed).toBe(100_000n);
    expect(balance.txCount).toBe(3);
  });

  it('keeps unconfirmed money out of the confirmed balance', async () => {
    // Money in the mempool can still be replaced or dropped, so it is reported
    // apart rather than added in.
    mockFetch({
      body: {
        chain_stats: { funded_txo_sum: 100_000, spent_txo_sum: 0, tx_count: 1 },
        mempool_stats: { funded_txo_sum: 25_000, spent_txo_sum: 0 },
      },
    });
    const balance = await fetchBitcoinBalance(ADDRESS);
    expect(balance.confirmed).toBe(100_000n);
    expect(balance.pending).toBe(25_000n);
  });

  it('reports a pending spend as negative', async () => {
    mockFetch({
      body: {
        chain_stats: { funded_txo_sum: 100_000, spent_txo_sum: 0, tx_count: 1 },
        mempool_stats: { funded_txo_sum: 0, spent_txo_sum: 40_000 },
      },
    });
    expect((await fetchBitcoinBalance(ADDRESS)).pending).toBe(-40_000n);
  });

  it('reads zero for an address the explorer has never seen', async () => {
    mockFetch({ body: { chain_stats: {}, mempool_stats: {} } });
    const balance = await fetchBitcoinBalance(ADDRESS);
    expect(balance.confirmed).toBe(0n);
    expect(balance.txCount).toBe(0);
  });

  it('refuses anything that is not a bech32 address', async () => {
    // The address goes into the request path, so it is checked before it can
    // reach the network at all.
    global.fetch = jest.fn() as unknown as typeof fetch;
    await expect(fetchBitcoinBalance('../../evil')).rejects.toThrow(/bech32/i);
    await expect(fetchBitcoinBalance('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2')).rejects.toThrow();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('reports rate limiting distinctly', async () => {
    mockFetch({ ok: false, status: 429 });
    await expect(fetchBitcoinBalance(ADDRESS)).rejects.toThrow(/rate limiting/i);
  });

  it('reports other failures with their status', async () => {
    mockFetch({ ok: false, status: 503 });
    await expect(fetchBitcoinBalance(ADDRESS)).rejects.toThrow(/503/);
  });

  it('surfaces a network failure rather than reading as an empty wallet', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
    await expect(fetchBitcoinBalance(ADDRESS)).rejects.toThrow(/offline/);
  });
});

describe('fetchBitcoinHistory', () => {
  const received = {
    txid: 'aa',
    fee: 500,
    vin: [{ prevout: { scriptpubkey_address: OTHER, value: 200_000 } }],
    vout: [{ scriptpubkey_address: ADDRESS, value: 120_000 }],
    status: { confirmed: true, block_time: 1_700_000_000 },
  };

  const sent = {
    txid: 'bb',
    fee: 1_000,
    vin: [{ prevout: { scriptpubkey_address: ADDRESS, value: 120_000 } }],
    vout: [
      { scriptpubkey_address: OTHER, value: 79_000 },
      // Change back to ourselves.
      { scriptpubkey_address: ADDRESS, value: 40_000 },
    ],
    status: { confirmed: true, block_time: 1_700_000_500 },
  };

  it('reads an incoming transfer', async () => {
    mockFetch({ body: [received] });
    const [entry] = await fetchBitcoinHistory(ADDRESS);
    expect(entry?.direction).toBe('in');
    expect(entry?.value).toBe(120_000n);
    expect(entry?.counterparty).toBe(OTHER);
  });

  it('reports what left the wallet, not the inputs it consumed', async () => {
    // Inputs 120k, change 40k, fee 1k: the recipient got 79k, and that is the
    // number the row must show.
    mockFetch({ body: [sent] });
    const [entry] = await fetchBitcoinHistory(ADDRESS);
    expect(entry?.direction).toBe('out');
    expect(entry?.value).toBe(79_000n);
    expect(entry?.counterparty).toBe(OTHER);
    expect(entry?.fee).toBe(1_000n);
  });

  it('does not charge the fee to an incoming transfer', async () => {
    // Somebody else paid it.
    mockFetch({ body: [received] });
    const [entry] = await fetchBitcoinHistory(ADDRESS);
    expect(entry?.fee).toBeNull();
  });

  it('calls a spend back to ourselves what it is', async () => {
    mockFetch({
      body: [
        {
          txid: 'cc',
          fee: 800,
          vin: [{ prevout: { scriptpubkey_address: ADDRESS, value: 50_000 } }],
          vout: [{ scriptpubkey_address: ADDRESS, value: 49_200 }],
          status: { confirmed: true, block_time: 1_700_000_900 },
        },
      ],
    });
    const [entry] = await fetchBitcoinHistory(ADDRESS);
    expect(entry?.direction).toBe('self');
    expect(entry?.value).toBe(0n);
  });

  it('leaves an unconfirmed transaction without a time, so it reads as pending', async () => {
    mockFetch({
      body: [{ ...received, status: { confirmed: false } }],
    });
    const [entry] = await fetchBitcoinHistory(ADDRESS);
    expect(entry?.timestamp).toBeNull();
  });

  it('dates a confirmed transaction from its block', async () => {
    mockFetch({ body: [received] });
    const [entry] = await fetchBitcoinHistory(ADDRESS);
    expect(entry?.timestamp?.getTime()).toBe(1_700_000_000_000);
  });

  it('never marks a bitcoin transaction as failed', async () => {
    // Bitcoin has no reverted transactions: it is in a block or it is not.
    mockFetch({ body: [received, sent] });
    const entries = await fetchBitcoinHistory(ADDRESS);
    expect(entries.every((entry) => entry.succeeded)).toBe(true);
  });

  it('drops an entry with no transaction id', async () => {
    mockFetch({ body: [{ vout: [] }, received] });
    expect(await fetchBitcoinHistory(ADDRESS)).toHaveLength(1);
  });

  it('copes with a coinbase input that has no prevout', async () => {
    mockFetch({
      body: [
        {
          txid: 'dd',
          vin: [{ prevout: null }],
          vout: [{ scriptpubkey_address: ADDRESS, value: 312_500_000 }],
          status: { confirmed: true, block_time: 1_700_001_000 },
        },
      ],
    });
    const [entry] = await fetchBitcoinHistory(ADDRESS);
    expect(entry?.direction).toBe('in');
    expect(entry?.counterparty).toBeNull();
  });

  it('copes with a body that is not a list', async () => {
    mockFetch({ body: { error: 'nope' } });
    expect(await fetchBitcoinHistory(ADDRESS)).toEqual([]);
  });

  it('honours the limit', async () => {
    mockFetch({ body: [received, sent, received] });
    expect(await fetchBitcoinHistory(ADDRESS, 2)).toHaveLength(2);
  });
});

describe('display', () => {
  it('shows bitcoin to the satoshi', async () => {
    // Six decimals, as ether uses, would round a dust balance away to zero.
    expect(formatAmount(1n, BITCOIN_UNIT)).toBe('0.00000001');
    expect(formatAmount(123_456_789n, BITCOIN_UNIT)).toBe('1.23456789');
  });

  it('links to the transaction and the address', () => {
    expect(bitcoinExplorer.tx('aa')).toContain('/tx/aa');
    expect(bitcoinExplorer.address(ADDRESS)).toContain(ADDRESS);
  });
});
