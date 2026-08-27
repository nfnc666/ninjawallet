import { formatCoin, parseCoin, shortenAddress } from '../chain';
import { NETWORKS } from '../networks';

const network = NETWORKS.sepolia;

describe('formatCoin', () => {
  it('formats whole coins', () => {
    expect(formatCoin(10n ** 18n, network)).toBe('1');
  });

  it('formats a fractional balance', () => {
    expect(formatCoin(1_500_000_000_000_000_000n, network)).toBe('1.5');
  });

  it('trims trailing zeroes rather than padding', () => {
    expect(formatCoin(1_200_000_000_000_000_000n, network)).toBe('1.2');
  });

  it('truncates below the requested precision instead of rounding up', () => {
    // 0.1234567 ETH with 6 digits must not read as 0.123457 — never round a
    // balance upward, it makes people think they can send more than they have.
    expect(formatCoin(123_456_700_000_000_000n, network, 6)).toBe('0.123456');
  });

  it('formats a zero balance as a bare zero', () => {
    expect(formatCoin(0n, network)).toBe('0');
  });

  it('keeps dust visible rather than collapsing it to zero', () => {
    expect(formatCoin(1_000_000_000_000n, network)).toBe('0.000001');
  });
});

describe('parseCoin', () => {
  it('parses a whole number', () => {
    expect(parseCoin('1', network)).toBe(10n ** 18n);
  });

  it('parses a decimal', () => {
    expect(parseCoin('0.5', network)).toBe(500_000_000_000_000_000n);
  });

  it('accepts a comma as the decimal separator', () => {
    expect(parseCoin('0,5', network)).toBe(500_000_000_000_000_000n);
  });

  it('ignores surrounding whitespace', () => {
    expect(parseCoin('  2.5 ', network)).toBe(2_500_000_000_000_000_000n);
  });

  it('round-trips through formatCoin', () => {
    const wei = parseCoin('3.14159', network);
    expect(formatCoin(wei, network)).toBe('3.14159');
  });

  it.each(['', 'abc', '1.2.3', '-1', '1e18', '0x10'])('rejects %p', (input) => {
    expect(() => parseCoin(input, network)).toThrow(/valid amount/i);
  });
});

describe('shortenAddress', () => {
  const address = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94';

  it('keeps the leading and trailing characters', () => {
    expect(shortenAddress(address)).toBe('0x9858…da94');
  });

  it('leaves a short string untouched', () => {
    expect(shortenAddress('0x1234')).toBe('0x1234');
  });
});

describe('NETWORKS', () => {
  it('defaults every explorer link to the matching chain', () => {
    expect(NETWORKS.sepolia.explorerTxUrl('0xabc')).toContain('sepolia.etherscan.io');
    expect(NETWORKS.ethereum.explorerTxUrl('0xabc')).toContain('//etherscan.io');
  });

  it('marks exactly one configured network as mainnet', () => {
    const mainnets = Object.values(NETWORKS).filter((entry) => entry.isMainnet);
    expect(mainnets).toHaveLength(1);
    expect(mainnets[0]?.id).toBe('ethereum');
  });
});
