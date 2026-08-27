import { Contract, formatUnits, parseUnits, type TransactionResponse } from 'ethers';

import { getProvider } from './chain';
import { deriveEvmWallet } from './derivation';
import { NETWORKS, type NetworkId } from './networks';
import { isNativeToken, networkSupportsSwap, type Token } from './tokens';

/**
 * Swapping through the 0x aggregator.
 *
 * 0x needs an API key, so there is no keyless default here the way there is for
 * prices and history. Without EXPO_PUBLIC_0X_API_KEY the screen says what is
 * missing instead of offering a button that cannot work — a swap that fails
 * halfway can leave a token approved to a spender for nothing.
 */
const SWAP_API_URL = process.env.EXPO_PUBLIC_0X_API_URL ?? 'https://api.0x.org';
const SWAP_API_KEY = process.env.EXPO_PUBLIC_0X_API_KEY;

/** Slippage choices, in basis points. 100 bps = 1%. */
export const SLIPPAGE_OPTIONS = [50, 100, 300] as const;
export const DEFAULT_SLIPPAGE_BPS = 100;
/**
 * Anything looser than 5% is far more likely to be a mistake than an intent,
 * and it is exactly the setting a sandwich attack feeds on.
 */
export const MAX_SLIPPAGE_BPS = 500;

const ERC20_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
];

export class SwapUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SwapUnavailableError';
  }
}

export function isSwapConfigured(): boolean {
  return typeof SWAP_API_KEY === 'string' && SWAP_API_KEY.length > 0;
}

export interface SwapQuote {
  sellToken: Token;
  buyToken: Token;
  sellAmount: bigint;
  /** Expected output at the quoted route. */
  buyAmount: bigint;
  /** Worst acceptable output after slippage — what the trade actually promises. */
  minBuyAmount: bigint;
  slippageBps: number;
  /** Contract the sell token must be approved to, when it is an ERC-20. */
  allowanceTarget: string | null;
  /** Allowance the taker is currently short by, if any. */
  allowanceShortfall: bigint | null;
  transaction: { to: string; data: string; value: bigint; gas: bigint | null };
  /** Route's implied price, as buy units per sell unit. */
  rate: number;
}

/** Validates a slippage setting before it reaches a quote. */
export function assertSlippage(bps: number): void {
  if (!Number.isInteger(bps) || bps <= 0) {
    throw new Error('Slippage must be a positive whole number of basis points.');
  }
  if (bps > MAX_SLIPPAGE_BPS) {
    throw new Error(
      `Slippage above ${MAX_SLIPPAGE_BPS / 100}% is refused — it invites a sandwich attack.`,
    );
  }
}

interface RawQuote {
  buyAmount?: unknown;
  minBuyAmount?: unknown;
  transaction?: { to?: unknown; data?: unknown; value?: unknown; gas?: unknown } | null;
  issues?: { allowance?: { actual?: unknown; spender?: unknown } | null } | null;
  liquidityAvailable?: unknown;
}

function toBigInt(value: unknown, field: string): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  if (typeof value === 'number' && Number.isInteger(value)) return BigInt(value);
  throw new SwapUnavailableError(`Quote is missing a usable ${field}.`);
}

/**
 * Asks the aggregator to price a swap.
 *
 * Refuses rather than guessing when the response is incomplete: a quote whose
 * `minBuyAmount` cannot be read has no floor, and signing that means agreeing
 * to any output at all.
 */
export async function fetchSwapQuote(params: {
  networkId: NetworkId;
  sellToken: Token;
  buyToken: Token;
  sellAmount: bigint;
  taker: string;
  slippageBps?: number;
}): Promise<SwapQuote> {
  const { networkId, sellToken, buyToken, sellAmount, taker } = params;
  const slippageBps = params.slippageBps ?? DEFAULT_SLIPPAGE_BPS;

  assertSlippage(slippageBps);
  if (sellAmount <= 0n) throw new Error('Amount must be greater than zero.');
  if (sellToken.address.toLowerCase() === buyToken.address.toLowerCase()) {
    throw new Error('Pick two different tokens.');
  }
  if (!networkSupportsSwap(networkId)) {
    throw new SwapUnavailableError(
      `Swapping is not available on ${NETWORKS[networkId].name}. Switch to Ethereum in Settings.`,
    );
  }
  if (!isSwapConfigured()) {
    throw new SwapUnavailableError(
      'Swapping needs a 0x API key. Set EXPO_PUBLIC_0X_API_KEY and restart.',
    );
  }

  const query = new URLSearchParams({
    chainId: String(NETWORKS[networkId].chainId),
    sellToken: sellToken.address,
    buyToken: buyToken.address,
    sellAmount: sellAmount.toString(),
    taker,
    slippageBps: String(slippageBps),
  });

  const response = await fetch(`${SWAP_API_URL}/swap/allowance-holder/quote?${query}`, {
    headers: {
      accept: 'application/json',
      '0x-api-key': SWAP_API_KEY as string,
      '0x-version': 'v2',
    },
  });

  if (!response.ok) {
    throw new SwapUnavailableError(`Quote service returned ${response.status}.`);
  }

  const raw = (await response.json()) as RawQuote;

  if (raw.liquidityAvailable === false) {
    throw new SwapUnavailableError('No route with enough liquidity for that amount.');
  }
  if (raw.transaction == null || typeof raw.transaction.to !== 'string'
    || typeof raw.transaction.data !== 'string') {
    throw new SwapUnavailableError('Quote did not include a transaction to sign.');
  }

  const buyAmount = toBigInt(raw.buyAmount, 'output amount');
  const minBuyAmount = toBigInt(raw.minBuyAmount, 'minimum output');

  // A floor above the expected output is incoherent; refuse rather than sign it.
  if (minBuyAmount > buyAmount) {
    throw new SwapUnavailableError('Quote is inconsistent — refusing to sign it.');
  }

  const allowance = raw.issues?.allowance ?? null;
  const spender = typeof allowance?.spender === 'string' ? allowance.spender : null;

  return {
    sellToken,
    buyToken,
    sellAmount,
    buyAmount,
    minBuyAmount,
    slippageBps,
    allowanceTarget: isNativeToken(sellToken) ? null : spender,
    allowanceShortfall: allowance !== null && spender !== null ? sellAmount : null,
    transaction: {
      to: raw.transaction.to,
      data: raw.transaction.data,
      value: toBigIntOrZero(raw.transaction.value),
      gas: tryBigInt(raw.transaction.gas),
    },
    rate: impliedRate(sellAmount, buyAmount, sellToken, buyToken),
  };
}

function toBigIntOrZero(value: unknown): bigint {
  return tryBigInt(value) ?? 0n;
}

function tryBigInt(value: unknown): bigint | null {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  if (typeof value === 'number' && Number.isInteger(value)) return BigInt(value);
  return null;
}

/** Buy units per one sell unit, for display only. */
export function impliedRate(
  sellAmount: bigint,
  buyAmount: bigint,
  sellToken: Token,
  buyToken: Token,
): number {
  if (sellAmount === 0n) return 0;
  const sold = Number(formatUnits(sellAmount, sellToken.decimals));
  const bought = Number(formatUnits(buyAmount, buyToken.decimals));
  return sold === 0 ? 0 : bought / sold;
}

/** How much worse than the quote the trade may end up, as a percentage. */
export function slippagePercent(quote: SwapQuote): number {
  if (quote.buyAmount === 0n) return 0;
  const shortfall = quote.buyAmount - quote.minBuyAmount;
  return (Number(shortfall) / Number(quote.buyAmount)) * 100;
}

/** True when the sell token still needs an allowance for this quote. */
export function needsApproval(quote: SwapQuote): boolean {
  return quote.allowanceTarget !== null && quote.allowanceShortfall !== null;
}

/**
 * Approves exactly the amount being sold, not an unlimited allowance.
 *
 * Infinite approvals are convenient and are also how a later contract bug or a
 * malicious upgrade drains a wallet months after the swap. The cost is one
 * approval per trade.
 */
export async function approveExactAmount(params: {
  networkId: NetworkId;
  phrase: string;
  accountIndex?: number;
  token: Token;
  spender: string;
  amount: bigint;
}): Promise<TransactionResponse> {
  const { networkId, phrase, accountIndex = 0, token, spender, amount } = params;
  if (isNativeToken(token)) throw new Error('The native coin does not need approval.');
  if (amount <= 0n) throw new Error('Approval amount must be greater than zero.');

  const provider = getProvider(networkId);
  const signer = deriveEvmWallet(phrase, accountIndex).connect(provider);
  const erc20 = new Contract(token.address, ERC20_ABI, signer);

  // getFunction rather than the dynamic property: ethers types the latter as
  // possibly undefined, and a silent no-op here would leave the swap stuck.
  const approve = erc20.getFunction('approve');
  return (await approve(spender, amount)) as TransactionResponse;
}

/** Current allowance the taker has granted `spender` for `token`. */
export async function readAllowance(params: {
  networkId: NetworkId;
  token: Token;
  owner: string;
  spender: string;
}): Promise<bigint> {
  const { networkId, token, owner, spender } = params;
  if (isNativeToken(token)) return 0n;

  const erc20 = new Contract(token.address, ERC20_ABI, getProvider(networkId));
  const allowance = erc20.getFunction('allowance');
  return (await allowance(owner, spender)) as bigint;
}

/**
 * Signs and broadcasts the aggregator's swap calldata.
 *
 * The quote is passed whole rather than re-derived, because the calldata and
 * the minimum output belong together — pairing fresh calldata with a stale
 * floor is how a swap silently executes at a worse price.
 */
export async function executeSwap(params: {
  networkId: NetworkId;
  phrase: string;
  accountIndex?: number;
  quote: SwapQuote;
}): Promise<TransactionResponse> {
  const { networkId, phrase, accountIndex = 0, quote } = params;

  if (needsApproval(quote)) {
    throw new Error('Approve the token before swapping.');
  }

  const provider = getProvider(networkId);
  const signer = deriveEvmWallet(phrase, accountIndex).connect(provider);

  return signer.sendTransaction({
    to: quote.transaction.to,
    data: quote.transaction.data,
    value: quote.transaction.value,
    ...(quote.transaction.gas !== null ? { gasLimit: quote.transaction.gas } : {}),
    chainId: NETWORKS[networkId].chainId,
  });
}

/** Parses a user-typed token amount into base units. */
export function parseTokenAmount(input: string, token: Token): bigint {
  const cleaned = input.trim().replace(',', '.');
  if (!/^\d*\.?\d+$/.test(cleaned)) throw new Error('Enter a valid amount.');
  return parseUnits(cleaned, token.decimals);
}

/** Formats base units for display, trimmed. */
export function formatTokenAmount(amount: bigint, token: Token, decimals = 6): string {
  const full = formatUnits(amount, token.decimals);
  const [whole, fraction = ''] = full.split('.');
  if (fraction === '' || decimals === 0) return whole ?? '0';
  const trimmed = fraction.slice(0, decimals).replace(/0+$/, '');
  return trimmed === '' ? (whole ?? '0') : `${whole}.${trimmed}`;
}
