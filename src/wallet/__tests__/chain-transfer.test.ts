import { parseEther } from 'ethers';

/**
 * The money path: fee quoting, the balance guard, and signing. A fake node
 * stands in for JsonRpcProvider so the real logic in chain.ts runs end to end
 * without touching a network.
 *
 * `mockNode` is named for jest's hoisting rule — the factory below is lifted
 * above the imports, and only `mock*` identifiers may be referenced from it.
 */
const mockNode = {
  chainId: 11155111,
  gasLimit: 21_000n,
  maxFeePerGas: 2_000_000_000n,
  maxPriorityFeePerGas: 1_000_000_000n,
  gasPrice: null as bigint | null,
  balance: parseEther('1'),
  nonce: 7,
  sent: [] as { raw: string }[],
};

jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers');

  class FakeProvider {
    async getNetwork() {
      return actual.Network.from(mockNode.chainId);
    }
    async estimateGas() {
      return mockNode.gasLimit;
    }
    async getFeeData() {
      return {
        maxFeePerGas: mockNode.maxFeePerGas,
        maxPriorityFeePerGas: mockNode.maxPriorityFeePerGas,
        gasPrice: mockNode.gasPrice,
      };
    }
    async getBalance() {
      return mockNode.balance;
    }
    async getTransactionCount() {
      return mockNode.nonce;
    }
    async broadcastTransaction(raw: string) {
      mockNode.sent.push({ raw });
      return actual.Transaction.from(raw);
    }
  }

  return { ...actual, JsonRpcProvider: FakeProvider };
});

// Imported after the mock so chain.ts builds its provider from the fake.
// eslint-disable-next-line import/first
import { quoteTransfer, sendNativeCoin } from '../chain';

const PHRASE =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const FROM = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94';
const TO = '0x6Fac4D18c912343BF86fa7049364Dd4E424Ab9C0';

const defaults = { ...mockNode };
beforeEach(() => {
  Object.assign(mockNode, defaults, { sent: [] });
});

describe('quoteTransfer', () => {
  it('prices a transfer from the node’s gas estimate and fee data', async () => {
    const quote = await quoteTransfer({
      networkId: 'sepolia',
      from: FROM,
      to: TO,
      amount: parseEther('0.1'),
    });

    expect(quote.gasLimit).toBe(21_000n);
    expect(quote.maxFeePerGas).toBe(2_000_000_000n);
    expect(quote.maxPriorityFeePerGas).toBe(1_000_000_000n);
    expect(quote.maxFee).toBe(21_000n * 2_000_000_000n);
  });

  it('rejects a malformed recipient before calling the node', async () => {
    await expect(
      quoteTransfer({ networkId: 'sepolia', from: FROM, to: 'not-an-address', amount: 1n }),
    ).rejects.toThrow(/valid address/i);
  });

  it('refuses when the balance cannot cover amount plus worst-case fee', async () => {
    mockNode.balance = parseEther('0.1');
    await expect(
      quoteTransfer({ networkId: 'sepolia', from: FROM, to: TO, amount: parseEther('0.1') }),
    ).rejects.toThrow(/not enough/i);
  });

  it('allows a transfer that exactly consumes the balance', async () => {
    const fee = 21_000n * 2_000_000_000n;
    mockNode.balance = parseEther('0.5') + fee;
    await expect(
      quoteTransfer({ networkId: 'sepolia', from: FROM, to: TO, amount: parseEther('0.5') }),
    ).resolves.toMatchObject({ maxFee: fee });
  });

  it('refuses one wei beyond the balance', async () => {
    const fee = 21_000n * 2_000_000_000n;
    mockNode.balance = parseEther('0.5') + fee - 1n;
    await expect(
      quoteTransfer({ networkId: 'sepolia', from: FROM, to: TO, amount: parseEther('0.5') }),
    ).rejects.toThrow(/not enough/i);
  });

  it('falls back to gasPrice on a pre-EIP-1559 node', async () => {
    mockNode.maxFeePerGas = null as unknown as bigint;
    mockNode.maxPriorityFeePerGas = null as unknown as bigint;
    mockNode.gasPrice = 3_000_000_000n;

    const quote = await quoteTransfer({
      networkId: 'sepolia',
      from: FROM,
      to: TO,
      amount: parseEther('0.1'),
    });
    expect(quote.maxFeePerGas).toBe(3_000_000_000n);
    expect(quote.maxPriorityFeePerGas).toBe(0n);
  });

  it('refuses to guess when the node returns no gas price at all', async () => {
    mockNode.maxFeePerGas = null as unknown as bigint;
    mockNode.gasPrice = null;
    await expect(
      quoteTransfer({ networkId: 'sepolia', from: FROM, to: TO, amount: parseEther('0.1') }),
    ).rejects.toThrow(/gas price/i);
  });
});

describe('sendNativeCoin', () => {
  it('signs a transaction the recipient can verify came from us', async () => {
    const tx = await sendNativeCoin({
      networkId: 'sepolia',
      phrase: PHRASE,
      to: TO,
      amount: parseEther('0.25'),
    });

    expect(mockNode.sent).toHaveLength(1);
    expect(tx.from).toBe(FROM);
    expect(tx.to).toBe(TO);
    expect(tx.value).toBe(parseEther('0.25'));
  });

  it('pins the chain id, so a signature cannot be replayed on another chain', async () => {
    const tx = await sendNativeCoin({
      networkId: 'sepolia',
      phrase: PHRASE,
      to: TO,
      amount: parseEther('0.25'),
    });
    expect(tx.chainId).toBe(11155111n);
  });

  it('carries the quoted fee into the signed transaction', async () => {
    const tx = await sendNativeCoin({
      networkId: 'sepolia',
      phrase: PHRASE,
      to: TO,
      amount: parseEther('0.25'),
    });
    expect(tx.gasLimit).toBe(21_000n);
    expect(tx.maxFeePerGas).toBe(2_000_000_000n);
  });

  it('rejects a zero amount without broadcasting', async () => {
    await expect(
      sendNativeCoin({ networkId: 'sepolia', phrase: PHRASE, to: TO, amount: 0n }),
    ).rejects.toThrow(/greater than zero/i);
    expect(mockNode.sent).toHaveLength(0);
  });

  it('rejects a negative amount without broadcasting', async () => {
    await expect(
      sendNativeCoin({ networkId: 'sepolia', phrase: PHRASE, to: TO, amount: -1n }),
    ).rejects.toThrow(/greater than zero/i);
    expect(mockNode.sent).toHaveLength(0);
  });

  it('rejects a malformed recipient without broadcasting', async () => {
    await expect(
      sendNativeCoin({ networkId: 'sepolia', phrase: PHRASE, to: '0xdead', amount: 1n }),
    ).rejects.toThrow(/valid address/i);
    expect(mockNode.sent).toHaveLength(0);
  });

  it('does not broadcast when the balance is short', async () => {
    mockNode.balance = parseEther('0.001');
    await expect(
      sendNativeCoin({ networkId: 'sepolia', phrase: PHRASE, to: TO, amount: parseEther('0.5') }),
    ).rejects.toThrow(/not enough/i);
    expect(mockNode.sent).toHaveLength(0);
  });

  it('re-quotes against the node rather than trusting a stale screen quote', async () => {
    // The confirm screen may have quoted while gas was cheap. If the node has
    // since repriced, the broadcast must carry the new fee, not the old one.
    mockNode.maxFeePerGas = 9_000_000_000n;
    const tx = await sendNativeCoin({
      networkId: 'sepolia',
      phrase: PHRASE,
      to: TO,
      amount: parseEther('0.25'),
    });
    expect(tx.maxFeePerGas).toBe(9_000_000_000n);
  });

  it('derives a different sender for a different account index', async () => {
    const tx = await sendNativeCoin({
      networkId: 'sepolia',
      phrase: PHRASE,
      accountIndex: 1,
      to: TO,
      amount: parseEther('0.25'),
    });
    expect(tx.from).not.toBe(FROM);
  });
});
