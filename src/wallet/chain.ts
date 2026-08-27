import {
  JsonRpcProvider,
  Network,
  formatUnits,
  isAddress,
  parseUnits,
  type TransactionResponse,
} from 'ethers';

import { deriveEvmWallet } from './derivation';
import { NETWORKS, type NetworkConfig, type NetworkId } from './networks';

const providers = new Map<NetworkId, JsonRpcProvider>();

/**
 * Returns a cached provider for `networkId`.
 *
 * `staticNetwork` pins the chain id we expect, so a provider that silently
 * answers for a different chain is rejected instead of us signing a
 * transaction against the wrong network.
 */
export function getProvider(networkId: NetworkId): JsonRpcProvider {
  const cached = providers.get(networkId);
  if (cached) return cached;

  const config = NETWORKS[networkId];
  const provider = new JsonRpcProvider(config.rpcUrl, config.chainId, {
    staticNetwork: Network.from(config.chainId),
  });
  providers.set(networkId, provider);
  return provider;
}

/** Native-coin balance, in wei. */
export async function getBalance(networkId: NetworkId, address: string): Promise<bigint> {
  return getProvider(networkId).getBalance(address);
}

export interface FeeQuote {
  /** Units of gas the transaction is expected to consume. */
  gasLimit: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  /** Worst-case fee: gasLimit × maxFeePerGas. */
  maxFee: bigint;
}

/**
 * Prices a native-coin transfer without sending it.
 *
 * Throws when the recipient is malformed or the account cannot cover
 * amount + worst-case fee, so the confirm screen can say why up front rather
 * than letting the node reject the broadcast.
 */
export async function quoteTransfer(params: {
  networkId: NetworkId;
  from: string;
  to: string;
  amount: bigint;
}): Promise<FeeQuote> {
  const { networkId, from, to, amount } = params;
  if (!isAddress(to)) throw new Error('That is not a valid address.');

  const provider = getProvider(networkId);
  const [gasLimit, feeData, balance] = await Promise.all([
    provider.estimateGas({ from, to, value: amount }),
    provider.getFeeData(),
    provider.getBalance(from),
  ]);

  const maxFeePerGas = feeData.maxFeePerGas ?? feeData.gasPrice;
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? 0n;
  if (maxFeePerGas === null) {
    throw new Error('The node did not return a gas price. Try again in a moment.');
  }

  const maxFee = gasLimit * maxFeePerGas;
  if (balance < amount + maxFee) {
    throw new Error(
      `Not enough ${NETWORKS[networkId].currencySymbol} to cover the amount plus network fee.`,
    );
  }

  return { gasLimit, maxFeePerGas, maxPriorityFeePerGas, maxFee };
}

/**
 * Signs and broadcasts a native-coin transfer.
 *
 * `phrase` is used to derive the signing key for the length of this call and is
 * never stored or logged. Re-quotes the fee immediately before signing so a
 * stale quote from the confirm screen cannot underprice the transaction.
 */
export async function sendNativeCoin(params: {
  networkId: NetworkId;
  phrase: string;
  accountIndex?: number;
  to: string;
  amount: bigint;
}): Promise<TransactionResponse> {
  const { networkId, phrase, accountIndex = 0, to, amount } = params;
  if (!isAddress(to)) throw new Error('That is not a valid address.');
  if (amount <= 0n) throw new Error('Amount must be greater than zero.');

  const provider = getProvider(networkId);
  const signer = deriveEvmWallet(phrase, accountIndex).connect(provider);

  const quote = await quoteTransfer({
    networkId,
    from: signer.address,
    to,
    amount,
  });

  return signer.sendTransaction({
    to,
    value: amount,
    gasLimit: quote.gasLimit,
    maxFeePerGas: quote.maxFeePerGas,
    maxPriorityFeePerGas: quote.maxPriorityFeePerGas,
    chainId: NETWORKS[networkId].chainId,
  });
}

/** Formats wei for display, trimmed to `decimals` fraction digits. */
export function formatCoin(value: bigint, config: NetworkConfig, decimals = 6): string {
  const full = formatUnits(value, config.currencyDecimals);
  const [whole, fraction = ''] = full.split('.');
  if (fraction === '' || decimals === 0) return whole ?? '0';
  const trimmed = fraction.slice(0, decimals).replace(/0+$/, '');
  return trimmed === '' ? (whole ?? '0') : `${whole}.${trimmed}`;
}

/**
 * Parses a user-typed amount into wei.
 * Throws on anything that is not a plain positive decimal.
 */
export function parseCoin(input: string, config: NetworkConfig): bigint {
  const cleaned = input.trim().replace(',', '.');
  if (!/^\d*\.?\d+$/.test(cleaned)) throw new Error('Enter a valid amount.');
  return parseUnits(cleaned, config.currencyDecimals);
}

/** Shortens an address for display: 0x1234…abcd. */
export function shortenAddress(address: string, lead = 6, tail = 4): string {
  if (address.length <= lead + tail + 1) return address;
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}
