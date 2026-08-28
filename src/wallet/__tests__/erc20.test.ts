import { parseEther, parseUnits } from 'ethers';

/**
 * ERC-20 balances and transfers against a fake node, so the real logic in
 * erc20.ts runs end to end without touching a network.
 *
 * `mock*` naming is jest's hoisting rule: the factory below is lifted above
 * the imports and may only reference `mock`-prefixed identifiers.
 */
const mockNode = {
  chainId: 1,
  gasLimit: 65_000n,
  maxFeePerGas: 2_000_000_000n,
  maxPriorityFeePerGas: 1_000_000_000n,
  nativeBalance: parseEther('1'),
  /** Token balance per contract address, lower-cased. */
  balances: {} as Record<string, bigint>,
  /** Contracts whose balanceOf should fail. */
  failing: [] as string[],
  estimateError: null as string | null,
  sent: [] as { token: string; to: string; amount: bigint; overrides: unknown }[],
};

jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers');

  class FakeProvider {
    async getNetwork() {
      return actual.Network.from(mockNode.chainId);
    }
    async getBalance() {
      return mockNode.nativeBalance;
    }
    async getFeeData() {
      return {
        maxFeePerGas: mockNode.maxFeePerGas,
        maxPriorityFeePerGas: mockNode.maxPriorityFeePerGas,
        gasPrice: null,
      };
    }
  }

  class FakeContract {
    address: string;
    constructor(address: string) {
      this.address = address.toLowerCase();
    }
    getFunction(name: string) {
      if (name === 'balanceOf') {
        return async () => {
          if (mockNode.failing.includes(this.address)) throw new Error('call reverted');
          return mockNode.balances[this.address] ?? 0n;
        };
      }
      if (name === 'transfer') {
        const transfer = async (to: string, amount: bigint, overrides: unknown) => {
          mockNode.sent.push({ token: this.address, to, amount, overrides });
          return { hash: '0xtoken' };
        };
        transfer.estimateGas = async () => {
          if (mockNode.estimateError !== null) throw new Error(mockNode.estimateError);
          return mockNode.gasLimit;
        };
        return transfer;
      }
      throw new Error(`unexpected function ${name}`);
    }
  }

  return { ...actual, JsonRpcProvider: FakeProvider, Contract: FakeContract };
});

// Imported after the mock so the module builds its provider from the fake.
/* eslint-disable import/first */
import { getTokenBalance, getTokenBalances, quoteTokenTransfer, sendToken } from '../erc20';
import { findToken, NATIVE_TOKEN_ADDRESS, tokensForNetwork } from '../tokens';
/* eslint-enable import/first */

const PHRASE =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const FROM = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94';
const TO = '0x6Fac4D18c912343BF86fa7049364Dd4E424Ab9C0';

const USDC = findToken('ethereum', 'USDC') as NonNullable<ReturnType<typeof findToken>>;
const ETH = findToken('ethereum', 'ETH') as NonNullable<ReturnType<typeof findToken>>;

const usdc = (amount: string) => parseUnits(amount, USDC.decimals);

beforeEach(() => {
  mockNode.balances = { [USDC.address.toLowerCase()]: usdc('100') };
  mockNode.failing = [];
  mockNode.estimateError = null;
  mockNode.nativeBalance = parseEther('1');
  mockNode.sent = [];
});

describe('reading balances', () => {
  it("reads a token balance in the token's own units", async () => {
    expect(await getTokenBalance('ethereum', USDC, FROM)).toBe(usdc('100'));
  });

  it('reads the native coin through the node, not through a contract', async () => {
    expect(await getTokenBalance('ethereum', ETH, FROM)).toBe(parseEther('1'));
    expect(ETH.address).toBe(NATIVE_TOKEN_ADDRESS);
  });

  it('leaves a token out when its call fails, rather than reporting zero', async () => {
    // "We could not read this" and "you hold none of this" look identical on a
    // balance line and mean very different things.
    mockNode.failing = [USDC.address.toLowerCase()];
    const balances = await getTokenBalances('ethereum', [USDC], FROM);
    expect(balances).not.toHaveProperty('USDC');
  });

  it('keeps reading the other tokens when one fails', async () => {
    mockNode.failing = [USDC.address.toLowerCase()];
    const tokens = tokensForNetwork('ethereum').filter(
      (token) => token.address !== NATIVE_TOKEN_ADDRESS,
    );
    const balances = await getTokenBalances('ethereum', tokens, FROM);
    expect(Object.keys(balances).length).toBe(tokens.length - 1);
  });
});

describe('quoteTokenTransfer', () => {
  it('prices a transfer at the estimated gas', async () => {
    const quote = await quoteTokenTransfer({
      networkId: 'ethereum',
      token: USDC,
      from: FROM,
      to: TO,
      amount: usdc('10'),
    });
    expect(quote.gasLimit).toBe(mockNode.gasLimit);
    expect(quote.maxFee).toBe(mockNode.gasLimit * mockNode.maxFeePerGas);
  });

  it('refuses more of the token than the account holds', async () => {
    await expect(
      quoteTokenTransfer({
        networkId: 'ethereum',
        token: USDC,
        from: FROM,
        to: TO,
        amount: usdc('101'),
      }),
    ).rejects.toThrow(/not enough USDC/i);
  });

  it('refuses when there is no ether for gas, and says that is what is missing', async () => {
    // The ordinary way a token transfer fails: plenty of USDC, no ETH.
    mockNode.nativeBalance = 1n;
    await expect(
      quoteTokenTransfer({
        networkId: 'ethereum',
        token: USDC,
        from: FROM,
        to: TO,
        amount: usdc('10'),
      }),
    ).rejects.toThrow(/network fee.*ETH/is);
  });

  it('surfaces a contract that would revert for this sender', async () => {
    mockNode.estimateError = 'execution reverted: blocked';
    await expect(
      quoteTokenTransfer({
        networkId: 'ethereum',
        token: USDC,
        from: FROM,
        to: TO,
        amount: usdc('10'),
      }),
    ).rejects.toThrow(/reverted/);
  });

  it('refuses a malformed recipient before asking the node anything', async () => {
    await expect(
      quoteTokenTransfer({
        networkId: 'ethereum',
        token: USDC,
        from: FROM,
        to: '0xnope',
        amount: usdc('1'),
      }),
    ).rejects.toThrow(/valid address/i);
  });

  it('refuses a zero amount', async () => {
    await expect(
      quoteTokenTransfer({ networkId: 'ethereum', token: USDC, from: FROM, to: TO, amount: 0n }),
    ).rejects.toThrow(/greater than zero/i);
  });

  it('sends the native coin through the native path, not this one', async () => {
    await expect(
      quoteTokenTransfer({
        networkId: 'ethereum',
        token: ETH,
        from: FROM,
        to: TO,
        amount: 1n,
      }),
    ).rejects.toThrow(/native coin/i);
  });
});

describe('sendToken', () => {
  it('transfers the amount to the recipient', async () => {
    const tx = await sendToken({
      networkId: 'ethereum',
      phrase: PHRASE,
      token: USDC,
      to: TO,
      amount: usdc('25'),
    });

    expect(tx.hash).toBe('0xtoken');
    expect(mockNode.sent).toHaveLength(1);
    expect(mockNode.sent[0]?.to).toBe(TO);
    expect(mockNode.sent[0]?.amount).toBe(usdc('25'));
    expect(mockNode.sent[0]?.token).toBe(USDC.address.toLowerCase());
  });

  it('pins the chain id, so the transaction cannot replay on another chain', async () => {
    await sendToken({
      networkId: 'ethereum',
      phrase: PHRASE,
      token: USDC,
      to: TO,
      amount: usdc('1'),
    });
    expect(mockNode.sent[0]?.overrides).toMatchObject({ chainId: 1 });
  });

  it('re-quotes before signing, so it cannot broadcast one it cannot afford', async () => {
    // The review screen's quote can be minutes old by the time Send is pressed.
    mockNode.balances = { [USDC.address.toLowerCase()]: usdc('5') };
    await expect(
      sendToken({
        networkId: 'ethereum',
        phrase: PHRASE,
        token: USDC,
        to: TO,
        amount: usdc('10'),
      }),
    ).rejects.toThrow(/not enough USDC/i);
    expect(mockNode.sent).toHaveLength(0);
  });

  it('refuses the native coin', async () => {
    await expect(
      sendToken({ networkId: 'ethereum', phrase: PHRASE, token: ETH, to: TO, amount: 1n }),
    ).rejects.toThrow(/native coin/i);
  });
});
