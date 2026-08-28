import type { CoinUnit } from './chain';
import type { HistoryEntry, TransferDirection } from './history';

/**
 * Bitcoin balance and history, read from a public Esplora API.
 *
 * Esplora (mempool.space, Blockstream) rather than a commercial explorer
 * because it needs no key, so this works on a fresh checkout. Point
 * EXPO_PUBLIC_BITCOIN_API_URL at your own instance to avoid the shared rate
 * limit and to stop a third party seeing which address you look up.
 *
 * Reading is all this does. Spending bitcoin means selecting UTXOs and signing
 * a witness transaction, which this build does not do — see the note on
 * {@link fetchBitcoinBalance}.
 */
const BITCOIN_API_URL =
  process.env.EXPO_PUBLIC_BITCOIN_API_URL ?? 'https://mempool.space/api';

/** Satoshis per bitcoin — bitcoin's decimals, as the EVM code means them. */
export const BITCOIN_DECIMALS = 8;

/**
 * How a bitcoin amount is displayed. Eight fraction digits, not the six ether
 * gets: a satoshi is the smallest thing bitcoin has, and hiding two of them
 * would round a dust balance away to nothing.
 */
export const BITCOIN_UNIT: CoinUnit = { symbol: 'BTC', decimals: BITCOIN_DECIMALS, precision: 8 };

export class BitcoinUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BitcoinUnavailableError';
  }
}

export interface BitcoinBalance {
  /** Confirmed balance, in satoshis. */
  confirmed: bigint;
  /**
   * Net change sitting in the mempool, in satoshis. Negative when a spend is
   * waiting to confirm. Kept apart from `confirmed` because unconfirmed money
   * can still disappear.
   */
  pending: bigint;
  /** Confirmed transactions this address appears in. */
  txCount: number;
}

/**
 * Bech32 addresses only — the shape this wallet derives (BIP-84).
 *
 * This also keeps whatever is in `address` out of the request path: the string
 * is interpolated into a URL, so it is matched against the character set
 * bech32 allows before it goes anywhere near the network.
 */
const BECH32_ADDRESS = /^(bc1|tb1)[023456789acdefghjklmnpqrstuvwxyz]{6,87}$/;

function requireAddress(address: string): string {
  if (!BECH32_ADDRESS.test(address)) {
    throw new BitcoinUnavailableError('Not a bech32 bitcoin address.');
  }
  return address;
}

/** Reads a whole number of satoshis; anything else is treated as missing. */
function toSats(value: unknown): bigint | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  return null;
}

interface EsploraStats {
  funded_txo_sum?: unknown;
  spent_txo_sum?: unknown;
  tx_count?: unknown;
}

/**
 * Fetches the balance of a single address.
 *
 * Single address, not the whole account: the wallet only ever shows the
 * BIP-84 address at index 0, so that is the only place it can have received
 * anything. It does not scan the account xpub for other derivation indices, so
 * coins sent to an address derived elsewhere from the same phrase are not
 * counted here — they are still yours, and still recoverable from the phrase.
 */
export async function fetchBitcoinBalance(address: string): Promise<BitcoinBalance> {
  const body = await get<{ chain_stats?: EsploraStats; mempool_stats?: EsploraStats }>(
    `/address/${requireAddress(address)}`,
  );

  const chain = netOf(body?.chain_stats);
  const mempool = netOf(body?.mempool_stats);
  const txCount = toSats(body?.chain_stats?.tx_count);

  return {
    confirmed: chain,
    pending: mempool,
    txCount: txCount === null ? 0 : Number(txCount),
  };
}

function netOf(stats: EsploraStats | undefined): bigint {
  const funded = toSats(stats?.funded_txo_sum) ?? 0n;
  const spent = toSats(stats?.spent_txo_sum) ?? 0n;
  return funded - spent;
}

interface EsploraOutput {
  scriptpubkey_address?: unknown;
  value?: unknown;
}

interface EsploraTx {
  txid?: unknown;
  fee?: unknown;
  vin?: { prevout?: EsploraOutput | null }[];
  vout?: EsploraOutput[];
  status?: { confirmed?: unknown; block_time?: unknown } | null;
}

/**
 * Fetches recent transactions for a single address, as the same
 * {@link HistoryEntry} rows the Ethereum history renders.
 *
 * Bitcoin has no failed transactions the way the EVM does — a transaction is
 * either in a block or it is not — so `succeeded` is always true and an
 * unconfirmed transaction is marked by having no timestamp, which the rows
 * already render as "Pending".
 */
export async function fetchBitcoinHistory(address: string, limit = 25): Promise<HistoryEntry[]> {
  const checked = requireAddress(address);
  const body = await get<EsploraTx[]>(`/address/${checked}/txs`);
  const items = Array.isArray(body) ? body : [];

  return items
    .map((item) => toEntry(item, checked))
    .filter((entry): entry is HistoryEntry => entry !== null)
    .slice(0, limit);
}

function sumFor(outputs: EsploraOutput[], address: string): bigint {
  return outputs.reduce((total, output) => {
    if (output?.scriptpubkey_address !== address) return total;
    return total + (toSats(output.value) ?? 0n);
  }, 0n);
}

function otherAddress(outputs: EsploraOutput[], address: string): string | null {
  for (const output of outputs) {
    const candidate = output?.scriptpubkey_address;
    if (typeof candidate === 'string' && candidate !== address) return candidate;
  }
  return null;
}

function toEntry(item: EsploraTx, address: string): HistoryEntry | null {
  const hash = typeof item.txid === 'string' ? item.txid : null;
  if (hash === null) return null;

  const outputs = Array.isArray(item.vout) ? item.vout : [];
  const inputs = Array.isArray(item.vin) ? item.vin : [];
  const spentPrevouts = inputs
    .map((input) => input?.prevout)
    .filter((prevout): prevout is EsploraOutput => prevout !== null && prevout !== undefined);

  const received = sumFor(outputs, address);
  const spent = sumFor(spentPrevouts, address);
  const fee = toSats(item.fee);

  let direction: TransferDirection;
  let value: bigint;
  let counterparty: string | null;

  if (spent === 0n) {
    direction = 'in';
    value = received;
    counterparty = otherAddress(spentPrevouts, address);
  } else {
    // We funded this one. What left the wallet is the inputs we contributed
    // less the change that came back, and the fee is separate from the amount
    // the recipient actually got, so it is subtracted out rather than shown as
    // part of the transfer.
    const outflow = spent - received - (fee ?? 0n);
    counterparty = otherAddress(outputs, address);
    if (outflow > 0n) {
      direction = 'out';
      value = outflow;
    } else {
      // Nothing left the wallet: a consolidation of our own coins, which cost
      // only the fee.
      direction = 'self';
      value = 0n;
      counterparty = null;
    }
  }

  const blockTime = toSats(item.status?.block_time);
  const confirmed = item.status?.confirmed === true;

  return {
    hash,
    direction,
    value,
    counterparty,
    // Unconfirmed transactions carry no time; the row shows them as pending.
    timestamp: confirmed && blockTime !== null ? new Date(Number(blockTime) * 1000) : null,
    succeeded: true,
    fee: direction === 'in' ? null : fee,
  };
}

async function get<T>(path: string): Promise<T | null> {
  let response: Response;
  try {
    response = await fetch(`${BITCOIN_API_URL}${path}`, { headers: { accept: 'application/json' } });
  } catch (caught) {
    throw new BitcoinUnavailableError(
      caught instanceof Error ? caught.message : 'Could not reach the bitcoin explorer.',
    );
  }

  if (response.status === 429) {
    throw new BitcoinUnavailableError('Bitcoin explorer is rate limiting. Try again shortly.');
  }
  if (!response.ok) {
    throw new BitcoinUnavailableError(`Bitcoin explorer returned ${response.status}.`);
  }

  return (await response.json()) as T | null;
}

/** Explorer links for an address and a transaction. */
export const bitcoinExplorer = {
  address: (address: string) => `https://mempool.space/address/${address}`,
  tx: (hash: string) => `https://mempool.space/tx/${hash}`,
};
