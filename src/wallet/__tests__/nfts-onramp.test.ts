import { fetchNfts } from '../history';
import { buildRampUrl, rampAvailability } from '../onramp';
import { NETWORKS } from '../networks';

const OWNER = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94';
const CONTRACT = '0x6Fac4D18c912343BF86fa7049364Dd4E424Ab9C0';
const originalFetch = global.fetch;

function mockFetch(response: { ok?: boolean; status?: number; body?: unknown }) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: response.ok ?? true,
    status: response.status ?? 200,
    json: async () => response.body,
  }) as unknown as typeof fetch;
}

function nft(overrides: Record<string, unknown> = {}) {
  return {
    id: '42',
    token: { address: CONTRACT, name: 'Ninjas', type: 'ERC-721' },
    metadata: { name: 'Ninja #42', image: 'https://example.test/42.png' },
    ...overrides,
  };
}

afterEach(() => {
  global.fetch = originalFetch;
});

describe('fetchNfts', () => {
  it('reads a collectible', async () => {
    mockFetch({ body: { items: [nft()] } });
    const [item] = await fetchNfts(NETWORKS.ethereum, OWNER);
    expect(item).toMatchObject({
      name: 'Ninja #42',
      collection: 'Ninjas',
      tokenId: '42',
      imageUrl: 'https://example.test/42.png',
      standard: 'ERC-721',
    });
  });

  it('rewrites ipfs:// onto a gateway so the image can load', async () => {
    mockFetch({ body: { items: [nft({ metadata: { image: 'ipfs://QmHash/1.png' } })] } });
    const [item] = await fetchNfts(NETWORKS.ethereum, OWNER);
    expect(item?.imageUrl).toBe('https://ipfs.io/ipfs/QmHash/1.png');
  });

  it('drops a non-http image scheme rather than handing it to the loader', async () => {
    // Contract metadata is attacker-controlled; data: and javascript: are not
    // worth rendering.
    mockFetch({
      body: { items: [nft({ metadata: { image: 'javascript:alert(1)' } })] },
    });
    const [item] = await fetchNfts(NETWORKS.ethereum, OWNER);
    expect(item?.imageUrl).toBeNull();
  });

  it('falls back to the token id when metadata has no name', async () => {
    mockFetch({ body: { items: [nft({ metadata: null })] } });
    const [item] = await fetchNfts(NETWORKS.ethereum, OWNER);
    expect(item?.name).toBe('#42');
  });

  it('labels an unnamed collection rather than showing a blank', async () => {
    mockFetch({ body: { items: [nft({ token: { address: CONTRACT, name: '  ' } })] } });
    const [item] = await fetchNfts(NETWORKS.ethereum, OWNER);
    expect(item?.collection).toBe('Unknown collection');
  });

  it('skips an entry with no usable contract address', async () => {
    mockFetch({ body: { items: [nft(), nft({ token: { address: 'nonsense' } })] } });
    await expect(fetchNfts(NETWORKS.ethereum, OWNER)).resolves.toHaveLength(1);
  });

  it('returns nothing for an address the explorer has not seen', async () => {
    mockFetch({ ok: false, status: 404 });
    await expect(fetchNfts(NETWORKS.ethereum, OWNER)).resolves.toEqual([]);
  });

  it('surfaces a server failure rather than an empty gallery', async () => {
    mockFetch({ ok: false, status: 500 });
    await expect(fetchNfts(NETWORKS.ethereum, OWNER)).rejects.toThrow(/500/);
  });
});

describe('rampAvailability', () => {
  it('refuses on a testnet, where the coins have no market', () => {
    const result = rampAvailability(NETWORKS.sepolia);
    expect(result.available).toBe(false);
    expect(result.reason).toMatch(/faucet/i);
  });

  it('is available on mainnet', () => {
    expect(rampAvailability(NETWORKS.ethereum).available).toBe(true);
  });
});

describe('buildRampUrl', () => {
  it('fills in the destination address, so it is never typed by hand', () => {
    const url = buildRampUrl({ side: 'buy', network: NETWORKS.ethereum, address: OWNER });
    expect(url).toContain(`walletAddress=${OWNER}`);
    expect(url).toContain('productsAvailed=BUY');
    expect(url).toContain('cryptoCurrencyCode=ETH');
  });

  it('switches the product for a sale', () => {
    const url = buildRampUrl({ side: 'sell', network: NETWORKS.ethereum, address: OWNER });
    expect(url).toContain('productsAvailed=SELL');
  });

  it('locks the address field so the prefill cannot be edited away', () => {
    const url = buildRampUrl({ side: 'buy', network: NETWORKS.ethereum, address: OWNER });
    expect(url).toContain('disableWalletAddressForm=true');
  });
});
