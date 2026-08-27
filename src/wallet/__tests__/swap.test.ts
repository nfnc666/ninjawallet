import {
  DEFAULT_SLIPPAGE_BPS,
  MAX_SLIPPAGE_BPS,
  assertSlippage,
  fetchSwapQuote,
  formatTokenAmount,
  impliedRate,
  isSwapConfigured,
  needsApproval,
  parseTokenAmount,
  slippagePercent,
  SwapUnavailableError,
  type SwapQuote,
} from '../swap';
import { findToken, networkSupportsSwap, NATIVE_TOKEN_ADDRESS, type Token } from '../tokens';

const ETH = findToken('ethereum', 'ETH') as Token;
const USDC = findToken('ethereum', 'USDC') as Token;
const TAKER = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94';
const SPENDER = '0x0000000000001fF3684f28c67538d4D072C22734';

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

function mockQuote(body: unknown, status = 200) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
}

function goodBody(overrides: Record<string, unknown> = {}) {
  return {
    liquidityAvailable: true,
    buyAmount: '3200000000',
    minBuyAmount: '3168000000',
    transaction: { to: SPENDER, data: '0xdeadbeef', value: '1000000000000000000', gas: '250000' },
    issues: { allowance: null },
    ...overrides,
  };
}

const quoteArgs = {
  networkId: 'ethereum' as const,
  sellToken: ETH,
  buyToken: USDC,
  sellAmount: 10n ** 18n,
  taker: TAKER,
};

describe('tokens', () => {
  it('offers no swap route on a testnet, where there is no real liquidity', () => {
    expect(networkSupportsSwap('sepolia')).toBe(false);
    expect(networkSupportsSwap('ethereum')).toBe(true);
  });

  it('marks the native coin with the aggregator pseudo-address', () => {
    expect(ETH.address).toBe(NATIVE_TOKEN_ADDRESS);
  });

  it('carries the right decimals per token', () => {
    expect(USDC.decimals).toBe(6);
    expect(ETH.decimals).toBe(18);
  });
});

describe('assertSlippage', () => {
  it('accepts the offered settings', () => {
    expect(() => assertSlippage(DEFAULT_SLIPPAGE_BPS)).not.toThrow();
    expect(() => assertSlippage(50)).not.toThrow();
  });

  it('refuses a setting loose enough to invite a sandwich attack', () => {
    expect(() => assertSlippage(MAX_SLIPPAGE_BPS + 1)).toThrow(/sandwich/i);
  });

  it('refuses zero and negative settings', () => {
    expect(() => assertSlippage(0)).toThrow();
    expect(() => assertSlippage(-100)).toThrow();
  });

  it('refuses a fractional basis point', () => {
    expect(() => assertSlippage(12.5)).toThrow();
  });
});

describe('fetchSwapQuote', () => {
  it('refuses without an API key rather than offering a broken swap', async () => {
    // No EXPO_PUBLIC_0X_API_KEY is set in the test environment.
    expect(isSwapConfigured()).toBe(false);
    await expect(fetchSwapQuote(quoteArgs)).rejects.toThrow(SwapUnavailableError);
    await expect(fetchSwapQuote(quoteArgs)).rejects.toThrow(/API key/i);
  });

  it('refuses on a chain with no swap route', async () => {
    await expect(
      fetchSwapQuote({ ...quoteArgs, networkId: 'sepolia' }),
    ).rejects.toThrow(/not available on/i);
  });

  it('refuses a zero amount', async () => {
    await expect(fetchSwapQuote({ ...quoteArgs, sellAmount: 0n })).rejects.toThrow(
      /greater than zero/i,
    );
  });

  it('refuses selling a token for itself', async () => {
    await expect(fetchSwapQuote({ ...quoteArgs, buyToken: ETH })).rejects.toThrow(
      /two different tokens/i,
    );
  });

  it('validates slippage before spending a request on it', async () => {
    global.fetch = jest.fn() as unknown as typeof fetch;
    await expect(fetchSwapQuote({ ...quoteArgs, slippageBps: 9999 })).rejects.toThrow(/sandwich/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('quote parsing', () => {
  // The guards below matter regardless of how the key is supplied, so they are
  // exercised through the same parsing path with the key check stubbed out.
  // The guards below matter regardless of how the key is supplied, so the
  // module is reloaded with one set. It reads the env var at import time, so a
  // fresh registry is the only way to flip it.
  const withKey = (
    body: unknown,
    status = 200,
    overrides: Partial<typeof quoteArgs> = {},
  ) => {
    mockQuote(body, status);
    jest.resetModules();
    process.env.EXPO_PUBLIC_0X_API_KEY = 'test-key';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const swap = require('../swap') as typeof import('../swap');
    return swap.fetchSwapQuote({ ...quoteArgs, ...overrides });
  };

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_0X_API_KEY;
    jest.resetModules();
  });

  it('reads the expected and minimum outputs', async () => {
    const quote = await withKey(goodBody());
    expect(quote.buyAmount).toBe(3_200_000_000n);
    expect(quote.minBuyAmount).toBe(3_168_000_000n);
  });

  it('refuses a quote whose floor exceeds its expected output', async () => {
    // Incoherent, and signing it would mean agreeing to terms nobody checked.
    await expect(
      withKey(goodBody({ buyAmount: '100', minBuyAmount: '200' })),
    ).rejects.toThrow(/inconsistent/i);
  });

  it('refuses a quote with no readable minimum, which would have no floor', async () => {
    await expect(withKey(goodBody({ minBuyAmount: null }))).rejects.toThrow(/minimum output/i);
  });

  it('refuses a quote with no transaction to sign', async () => {
    await expect(withKey(goodBody({ transaction: null }))).rejects.toThrow(/transaction to sign/i);
  });

  it('refuses when the route has no liquidity', async () => {
    await expect(withKey(goodBody({ liquidityAvailable: false }))).rejects.toThrow(/liquidity/i);
  });

  it('reports a service failure with its status', async () => {
    await expect(withKey(goodBody(), 502)).rejects.toThrow(/502/);
  });

  it('treats a missing gas figure as absent rather than zero', async () => {
    const quote = await withKey(goodBody({
      transaction: { to: SPENDER, data: '0x00', value: '0', gas: null },
    }));
    expect(quote.transaction.gas).toBeNull();
  });

  it('reports an allowance the taker still needs to grant on an ERC-20 sell', async () => {
    const quote = await withKey(
      goodBody({ issues: { allowance: { actual: '0', spender: SPENDER } } }),
      200,
      { sellToken: USDC, buyToken: ETH },
    );
    expect(quote.allowanceTarget).toBe(SPENDER);
    expect(needsApproval(quote)).toBe(true);
  });

  it('never asks for an allowance when selling the native coin', async () => {
    // ETH has no allowance concept; reporting one would add a pointless
    // approval transaction the user pays gas for.
    const quote = await withKey(
      goodBody({ issues: { allowance: { actual: '0', spender: SPENDER } } }),
    );
    expect(quote.allowanceTarget).toBeNull();
    expect(needsApproval(quote)).toBe(false);
  });
});

describe('needsApproval', () => {
  it('is false for the native coin, which has no allowance concept', () => {
    const quote = { allowanceTarget: null, allowanceShortfall: null } as SwapQuote;
    expect(needsApproval(quote)).toBe(false);
  });
});

describe('slippagePercent', () => {
  it('reports the gap between quote and floor', () => {
    const quote = { buyAmount: 1000n, minBuyAmount: 990n } as SwapQuote;
    expect(slippagePercent(quote)).toBeCloseTo(1, 6);
  });

  it('is zero when the floor equals the quote', () => {
    expect(slippagePercent({ buyAmount: 1000n, minBuyAmount: 1000n } as SwapQuote)).toBe(0);
  });

  it('does not divide by zero on an empty quote', () => {
    expect(slippagePercent({ buyAmount: 0n, minBuyAmount: 0n } as SwapQuote)).toBe(0);
  });
});

describe('impliedRate', () => {
  it('reports buy units per sell unit across differing decimals', () => {
    // 1 ETH (18dp) for 3200 USDC (6dp).
    expect(impliedRate(10n ** 18n, 3_200_000_000n, ETH, USDC)).toBeCloseTo(3200, 6);
  });

  it('is zero rather than Infinity for a zero input', () => {
    expect(impliedRate(0n, 1n, ETH, USDC)).toBe(0);
  });
});

describe('token amounts', () => {
  it('parses against the token’s own decimals', () => {
    expect(parseTokenAmount('1', USDC)).toBe(1_000_000n);
    expect(parseTokenAmount('1', ETH)).toBe(10n ** 18n);
  });

  it('accepts a comma as the decimal separator', () => {
    expect(parseTokenAmount('1,5', USDC)).toBe(1_500_000n);
  });

  it.each(['', 'abc', '1.2.3', '-1', '1e6'])('rejects %p', (input) => {
    expect(() => parseTokenAmount(input, USDC)).toThrow(/valid amount/i);
  });

  it('formats without trailing zeroes', () => {
    expect(formatTokenAmount(1_500_000n, USDC)).toBe('1.5');
    expect(formatTokenAmount(1_000_000n, USDC)).toBe('1');
  });

  it('truncates rather than rounding up', () => {
    expect(formatTokenAmount(1_234_567n, USDC, 4)).toBe('1.2345');
  });
});
