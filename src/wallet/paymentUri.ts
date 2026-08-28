import { getAddress, isAddress } from 'ethers';

/**
 * Parsing what a QR code actually contains.
 *
 * A payment QR is rarely a bare address. Wallets encode EIP-681
 * (`ethereum:0x…@1?value=…`) and BIP-21 (`bitcoin:bc1…?amount=…`), often with
 * an amount and a chain id attached. Treating the whole string as an address
 * would fail; worse, taking the first hex-looking run out of it could pick up
 * a *different* address than the one the payload means.
 *
 * So this parses the forms it recognises and refuses everything else. A QR
 * that cannot be understood is rejected, never guessed at.
 */

export type PaymentChain = 'evm' | 'bitcoin';

export interface PaymentRequest {
  chain: PaymentChain;
  /** Checksummed for EVM, left as written for Bitcoin. */
  address: string;
  /** Requested amount as typed in the URI, in whole coins. Null when absent. */
  amount: string | null;
  /** EIP-681 chain id, when the payload pinned one. */
  chainId: number | null;
}

export class UnreadablePaymentCodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnreadablePaymentCodeError';
  }
}

/** Bech32 mainnet/testnet P2WPKH or P2TR, plus base58 legacy. */
const BITCOIN_ADDRESS = /^(bc1|tb1)[023456789acdefghjklmnpqrstuvwxyz]{6,87}$|^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;

function parseQuery(search: string): URLSearchParams {
  return new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
}

/** Amounts must be plain decimals; anything else is not a number we will use. */
function readAmount(raw: string | null): string | null {
  if (raw === null) return null;
  const cleaned = raw.trim();
  return /^\d*\.?\d+$/.test(cleaned) ? cleaned : null;
}

/**
 * Reads a scanned string into a payment request.
 *
 * @throws UnreadablePaymentCodeError when the payload is not a payment code
 * this build understands.
 */
export function parsePaymentCode(input: string): PaymentRequest {
  const raw = input.trim();
  if (raw === '') throw new UnreadablePaymentCodeError('That QR code is empty.');

  const colon = raw.indexOf(':');
  const scheme = colon === -1 ? null : raw.slice(0, colon).toLowerCase();

  if (scheme === 'ethereum') return parseEip681(raw.slice(colon + 1));
  if (scheme === 'bitcoin') return parseBip21(raw.slice(colon + 1));
  if (scheme !== null) {
    throw new UnreadablePaymentCodeError(`“${scheme}:” is not a payment code this wallet reads.`);
  }

  // No scheme: accept a bare address of either kind.
  if (isAddress(raw)) {
    return { chain: 'evm', address: getAddress(raw), amount: null, chainId: null };
  }
  if (BITCOIN_ADDRESS.test(raw)) {
    return { chain: 'bitcoin', address: raw, amount: null, chainId: null };
  }

  throw new UnreadablePaymentCodeError('That QR code does not contain an address.');
}

/** `ethereum:0xabc…@1?value=1e18` — also tolerates `pay-` and plain `?value=`. */
function parseEip681(body: string): PaymentRequest {
  const withoutPrefix = body.startsWith('pay-') ? body.slice('pay-'.length) : body;

  const queryStart = withoutPrefix.indexOf('?');
  const target = queryStart === -1 ? withoutPrefix : withoutPrefix.slice(0, queryStart);
  const query = parseQuery(queryStart === -1 ? '' : withoutPrefix.slice(queryStart));

  // A function call (`…/transfer`) moves a token, not the native coin. Reading
  // it as a plain transfer would send ether to a token contract.
  const [addressPart, ...rest] = target.split('/');
  if (rest.length > 0) {
    throw new UnreadablePaymentCodeError(
      'That code requests a contract call, which this wallet cannot build.',
    );
  }

  const [address, chainPart] = (addressPart ?? '').split('@');
  if (address === undefined || !isAddress(address)) {
    throw new UnreadablePaymentCodeError('That code does not contain a valid Ethereum address.');
  }

  let chainId: number | null = null;
  if (chainPart !== undefined && chainPart !== '') {
    const parsed = Number(chainPart);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new UnreadablePaymentCodeError('That code names a chain this wallet cannot read.');
    }
    chainId = parsed;
  }

  return {
    chain: 'evm',
    address: getAddress(address),
    amount: readAmount(query.get('value') ?? query.get('amount')),
    chainId,
  };
}

/** `bitcoin:bc1…?amount=0.5&label=…` */
function parseBip21(body: string): PaymentRequest {
  const queryStart = body.indexOf('?');
  const address = queryStart === -1 ? body : body.slice(0, queryStart);
  const query = parseQuery(queryStart === -1 ? '' : body.slice(queryStart));

  if (!BITCOIN_ADDRESS.test(address)) {
    throw new UnreadablePaymentCodeError('That code does not contain a valid Bitcoin address.');
  }

  return {
    chain: 'bitcoin',
    address,
    amount: readAmount(query.get('amount')),
    chainId: null,
  };
}
