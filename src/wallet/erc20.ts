import { Contract, isAddress, type TransactionResponse } from 'ethers';

import { getProvider, type FeeQuote } from './chain';
import { deriveEvmWallet } from './derivation';
import { NETWORKS, type NetworkId } from './networks';
import { isNativeToken, type Token } from './tokens';

/**
 * The slice of ERC-20 this wallet uses. Deliberately small: every function
 * here is one the app calls, and a wider ABI would invite calling something
 * that has not been thought through.
 */
export const ERC20_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
];

/** Balance of one token, in its smallest unit. */
export async function getTokenBalance(
  networkId: NetworkId,
  token: Token,
  owner: string,
): Promise<bigint> {
  if (isNativeToken(token)) return getProvider(networkId).getBalance(owner);

  const erc20 = new Contract(token.address, ERC20_ABI, getProvider(networkId));
  return (await erc20.getFunction('balanceOf')(owner)) as bigint;
}

/**
 * Balances for several tokens at once.
 *
 * A token whose call fails is left out of the result rather than recorded as
 * zero: "we could not read this" and "you hold none of this" look identical on
 * a balance line and mean very different things.
 */
export async function getTokenBalances(
  networkId: NetworkId,
  tokens: Token[],
  owner: string,
): Promise<Record<string, bigint>> {
  const results = await Promise.allSettled(
    tokens.map((token) => getTokenBalance(networkId, token, owner)),
  );

  const balances: Record<string, bigint> = {};
  results.forEach((result, index) => {
    const token = tokens[index];
    if (token !== undefined && result.status === 'fulfilled') {
      balances[token.symbol] = result.value;
    }
  });
  return balances;
}

/**
 * Prices a token transfer without sending it.
 *
 * Two balances have to hold, not one: the token pays the recipient and the
 * native coin pays the gas. Holding plenty of USDC and no ether is the ordinary
 * way a token transfer fails, so it is checked here and named, rather than
 * surfacing as a rejected broadcast.
 */
export async function quoteTokenTransfer(params: {
  networkId: NetworkId;
  token: Token;
  from: string;
  to: string;
  amount: bigint;
}): Promise<FeeQuote> {
  const { networkId, token, from, to, amount } = params;
  if (isNativeToken(token)) throw new Error('Use quoteTransfer for the native coin.');
  if (!isAddress(to)) throw new Error('That is not a valid address.');
  if (amount <= 0n) throw new Error('Amount must be greater than zero.');

  const provider = getProvider(networkId);
  const erc20 = new Contract(token.address, ERC20_ABI, provider);
  const transfer = erc20.getFunction('transfer');

  const [tokenBalance, nativeBalance, feeData] = await Promise.all([
    getTokenBalance(networkId, token, from),
    provider.getBalance(from),
    provider.getFeeData(),
  ]);

  if (tokenBalance < amount) {
    throw new Error(`Not enough ${token.symbol} for this transfer.`);
  }

  // Estimated against the real sender, so a token that would revert on this
  // account — a blocklist, a paused contract — is caught before signing.
  const gasLimit = await transfer.estimateGas(to, amount, { from });

  const maxFeePerGas = feeData.maxFeePerGas ?? feeData.gasPrice;
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? 0n;
  if (maxFeePerGas === null) {
    throw new Error('The node did not return a gas price. Try again in a moment.');
  }

  const maxFee = gasLimit * maxFeePerGas;
  if (nativeBalance < maxFee) {
    throw new Error(
      `Not enough ${NETWORKS[networkId].currencySymbol} to pay the network fee. ` +
        `Sending ${token.symbol} still costs gas in ${NETWORKS[networkId].currencySymbol}.`,
    );
  }

  return { gasLimit, maxFeePerGas, maxPriorityFeePerGas, maxFee };
}

/**
 * Signs and broadcasts a token transfer.
 *
 * Re-quotes immediately before signing, like the native send, so a stale
 * estimate from the review screen cannot underprice the transaction.
 */
export async function sendToken(params: {
  networkId: NetworkId;
  phrase: string;
  accountIndex?: number;
  token: Token;
  to: string;
  amount: bigint;
}): Promise<TransactionResponse> {
  const { networkId, phrase, accountIndex = 0, token, to, amount } = params;
  if (isNativeToken(token)) throw new Error('Use sendNativeCoin for the native coin.');
  if (!isAddress(to)) throw new Error('That is not a valid address.');
  if (amount <= 0n) throw new Error('Amount must be greater than zero.');

  const provider = getProvider(networkId);
  const signer = deriveEvmWallet(phrase, accountIndex).connect(provider);

  const quote = await quoteTokenTransfer({
    networkId,
    token,
    from: signer.address,
    to,
    amount,
  });

  const erc20 = new Contract(token.address, ERC20_ABI, signer);
  return (await erc20.getFunction('transfer')(to, amount, {
    gasLimit: quote.gasLimit,
    maxFeePerGas: quote.maxFeePerGas,
    maxPriorityFeePerGas: quote.maxPriorityFeePerGas,
    chainId: NETWORKS[networkId].chainId,
  })) as TransactionResponse;
}
