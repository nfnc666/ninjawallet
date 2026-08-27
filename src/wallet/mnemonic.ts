import * as Crypto from 'expo-crypto';
import { Mnemonic } from 'ethers';

/** Number of words in a recovery phrase. 12 words = 128 bits of entropy. */
export type MnemonicStrength = 12 | 24;

const ENTROPY_BYTES: Record<MnemonicStrength, number> = {
  12: 16,
  24: 32,
};

/**
 * Source of entropy for a new wallet. Injectable so tests can pin a known
 * value; production always uses the platform CSPRNG.
 */
export type EntropySource = (byteCount: number) => Promise<Uint8Array>;

/** Platform CSPRNG — SecRandomCopyBytes on iOS, SecureRandom on Android. */
export const nativeEntropy: EntropySource = (byteCount) =>
  Crypto.getRandomBytesAsync(byteCount);

/**
 * Generates a fresh BIP-39 recovery phrase.
 *
 * The phrase is the wallet. It is returned in plaintext because the user has to
 * write it down — never log it, never send it anywhere, and hand it to
 * {@link saveWallet} as soon as the user has confirmed the backup.
 */
export async function generateMnemonic(
  strength: MnemonicStrength = 12,
  entropySource: EntropySource = nativeEntropy,
): Promise<string> {
  const entropy = await entropySource(ENTROPY_BYTES[strength]);

  if (entropy.length !== ENTROPY_BYTES[strength]) {
    throw new Error('Entropy source returned the wrong number of bytes.');
  }
  if (entropy.every((byte) => byte === 0)) {
    throw new Error('Entropy source returned all zeroes — refusing to create a wallet.');
  }

  return Mnemonic.fromEntropy(entropy).phrase;
}

/** True when `phrase` is a valid BIP-39 phrase with a correct checksum. */
export function isValidMnemonic(phrase: string): boolean {
  return Mnemonic.isValidMnemonic(normalizeMnemonic(phrase));
}

/**
 * Normalizes user input before validation: BIP-39 phrases are lowercase,
 * single-space separated, and NFKD-normalized.
 */
export function normalizeMnemonic(phrase: string): string {
  return phrase.normalize('NFKD').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Picks `count` distinct word positions to quiz the user on during backup
 * verification. Uses the CSPRNG so the challenge is not predictable.
 */
export async function pickVerificationIndices(
  wordCount: number,
  count = 3,
  entropySource: EntropySource = nativeEntropy,
): Promise<number[]> {
  const chosen = new Set<number>();
  // Rejection-sample rather than take a modulus, which would bias low indices.
  while (chosen.size < Math.min(count, wordCount)) {
    const [byte] = await entropySource(1);
    if (byte === undefined) continue;
    const limit = 256 - (256 % wordCount);
    if (byte >= limit) continue;
    chosen.add(byte % wordCount);
  }
  return [...chosen].sort((a, b) => a - b);
}
