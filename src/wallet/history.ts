import { getAddress } from 'ethers';

import type { NetworkConfig } from './networks';

/**
 * Transaction history, read from Blockscout's public API.
 *
 * Blockscout rather than Etherscan because its API needs no key, so history
 * works on a fresh checkout instead of behind a signup. Point
 * EXPO_PUBLIC_HISTORY_API_URL at your own instance to avoid the shared rate
 * limit and to stop a third party seeing every address you look up.
 */
const HISTORY_API_OVERRIDE = process.env.EXPO_PUBLIC_HISTORY_API_URL;

export type TransferDirection = 'in' | 'out' | 'self';

export interface HistoryEntry {
  hash: string;
  direction: TransferDirection;
  /** Native-coin amount moved, in wei. */
  value: bigint;
  /** Counterparty: the recipient for an outgoing transfer, else the sender. */
  counterparty: string | null;
  timestamp: Date | null;
  /** False when the chain recorded the transaction as reverted. */
  succeeded: boolean;
  /** Fee actually paid, in wei. Null when the API did not report it. */
  fee: bigint | null;
}

export class HistoryUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HistoryUnavailableError';
  }
}

interface BlockscoutTx {
  hash?: unknown;
  value?: unknown;
  timestamp?: unknown;
  status?: unknown;
  result?: unknown;
  from?: { hash?: unknown } | null;
  to?: { hash?: unknown } | null;
  fee?: { value?: unknown } | null;
}

function toBigInt(value: unknown): bigint | null {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  return null;
}

function toAddress(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    return getAddress(value);
  } catch {
    return null;
  }
}

/**
 * Fetches recent native-coin transactions for `address`.
 *
 * Contract calls and token transfers are excluded: this build only understands
 * native transfers, and listing a token movement as if it were ether would
 * misreport what happened.
 */
export async function fetchHistory(
  network: NetworkConfig,
  address: string,
  limit = 25,
): Promise<HistoryEntry[]> {
  const base = HISTORY_API_OVERRIDE ?? network.historyApiUrl;
  const url = `${base}/addresses/${address}/transactions?filter=to%20%7C%20from`;

  let response: Response;
  try {
    response = await fetch(url, { headers: { accept: 'application/json' } });
  } catch (caught) {
    throw new HistoryUnavailableError(
      caught instanceof Error ? caught.message : 'Could not reach the explorer.',
    );
  }

  if (response.status === 404) return [];
  if (response.status === 429) {
    throw new HistoryUnavailableError('Explorer is rate limiting. Try again shortly.');
  }
  if (!response.ok) {
    throw new HistoryUnavailableError(`Explorer returned ${response.status}.`);
  }

  const body = (await response.json()) as { items?: BlockscoutTx[] } | null;
  const items = Array.isArray(body?.items) ? body.items : [];
  const self = toAddress(address);

  return items
    .map((item) => toEntry(item, self))
    .filter((entry): entry is HistoryEntry => entry !== null)
    .slice(0, limit);
}

function toEntry(item: BlockscoutTx, self: string | null): HistoryEntry | null {
  const hash = typeof item.hash === 'string' ? item.hash : null;
  const value = toBigInt(item.value);
  if (hash === null || value === null) return null;

  const from = toAddress(item.from?.hash);
  const to = toAddress(item.to?.hash);

  // Contract creations have no `to`; nothing useful to show for them here.
  if (to === null && from === null) return null;

  let direction: TransferDirection = 'in';
  if (self !== null && from === self && to === self) direction = 'self';
  else if (self !== null && from === self) direction = 'out';

  const timestampValue =
    typeof item.timestamp === 'string' ? new Date(item.timestamp) : null;

  return {
    hash,
    direction,
    value,
    counterparty: direction === 'out' ? to : from,
    timestamp:
      timestampValue !== null && !Number.isNaN(timestampValue.getTime()) ? timestampValue : null,
    // Blockscout reports `status: "ok"` for success and `"error"` for a revert.
    succeeded: item.status !== 'error',
    fee: toBigInt(item.fee?.value),
  };
}

/** A short, human date for a history row. */
export function formatWhen(timestamp: Date | null): string {
  if (timestamp === null) return 'Pending';

  const now = Date.now();
  const seconds = Math.round((now - timestamp.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} h ago`;
  if (seconds < 7 * 86_400) return `${Math.floor(seconds / 86_400)} d ago`;

  return timestamp.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: timestamp.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
}

export interface NftItem {
  /** Contract address plus token id, unique per item. */
  id: string;
  name: string;
  collection: string;
  tokenId: string;
  /** Best available image URL, already normalised off IPFS. */
  imageUrl: string | null;
  standard: string;
}

interface BlockscoutNft {
  id?: unknown;
  token?: { address?: unknown; name?: unknown; symbol?: unknown; type?: unknown } | null;
  metadata?: { name?: unknown; image?: unknown; image_url?: unknown } | null;
  image_url?: unknown;
}

/** Rewrites ipfs:// onto a gateway so the image can actually load. */
function normaliseImage(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  if (value.startsWith('ipfs://')) {
    return `https://ipfs.io/ipfs/${value.slice('ipfs://'.length).replace(/^ipfs\//, '')}`;
  }
  // Only http(s) is rendered: data: and other schemes are not worth the risk
  // of handing an arbitrary payload to the image loader.
  return /^https?:\/\//.test(value) ? value : null;
}

/**
 * Lists the NFTs an address holds, from the same keyless explorer API.
 *
 * Metadata is written by whoever deployed the contract, so every field is
 * treated as untrusted: names fall back to the token id, and image URLs are
 * dropped unless they are plain http(s) or ipfs.
 */
export async function fetchNfts(
  network: NetworkConfig,
  address: string,
  limit = 50,
): Promise<NftItem[]> {
  const base = HISTORY_API_OVERRIDE ?? network.historyApiUrl;
  const url = `${base}/addresses/${address}/nft?type=ERC-721%2CERC-1155`;

  let response: Response;
  try {
    response = await fetch(url, { headers: { accept: 'application/json' } });
  } catch (caught) {
    throw new HistoryUnavailableError(
      caught instanceof Error ? caught.message : 'Could not reach the explorer.',
    );
  }

  if (response.status === 404) return [];
  if (response.status === 429) {
    throw new HistoryUnavailableError('Explorer is rate limiting. Try again shortly.');
  }
  if (!response.ok) {
    throw new HistoryUnavailableError(`Explorer returned ${response.status}.`);
  }

  const body = (await response.json()) as { items?: BlockscoutNft[] } | null;
  const items = Array.isArray(body?.items) ? body.items : [];

  return items
    .map((item): NftItem | null => {
      const tokenId = typeof item.id === 'string' ? item.id : null;
      const contract = toAddress(item.token?.address);
      if (tokenId === null || contract === null) return null;

      const collection =
        typeof item.token?.name === 'string' && item.token.name.trim() !== ''
          ? item.token.name
          : 'Unknown collection';
      const name =
        typeof item.metadata?.name === 'string' && item.metadata.name.trim() !== ''
          ? item.metadata.name
          : `#${tokenId}`;

      return {
        id: `${contract}:${tokenId}`,
        name,
        collection,
        tokenId,
        imageUrl:
          normaliseImage(item.image_url) ??
          normaliseImage(item.metadata?.image_url) ??
          normaliseImage(item.metadata?.image),
        standard: typeof item.token?.type === 'string' ? item.token.type : 'ERC-721',
      };
    })
    .filter((item): item is NftItem => item !== null)
    .slice(0, limit);
}
