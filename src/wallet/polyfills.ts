import { getRandomValues } from 'expo-crypto';

/**
 * Crypto polyfills. This module MUST be imported before anything that touches
 * `ethers`, because ethers' key generation reaches for `crypto.getRandomValues`
 * at call time and Hermes does not ship one.
 *
 * The source is expo-crypto, which is backed by the platform CSPRNG
 * (SecRandomCopyBytes on iOS, SecureRandom on Android) — the same guarantee
 * `react-native-get-random-values` gives, and the reason this is a safe swap.
 * expo-crypto is part of the Expo SDK, so it is present in Expo Go: the app
 * runs on a phone by scanning a QR code, with no native build to produce
 * first. A wallet nobody can start is a wallet nobody can check.
 */
function installGetRandomValues(): void {
  const existing = globalThis.crypto as { getRandomValues?: unknown } | undefined;

  // A runtime that already has one — Node under Jest, a browser — keeps it.
  if (typeof existing?.getRandomValues === 'function') return;

  if (existing !== undefined) {
    try {
      (existing as { getRandomValues: typeof getRandomValues }).getRandomValues = getRandomValues;
      if (typeof globalThis.crypto.getRandomValues === 'function') return;
    } catch {
      // A frozen `crypto` object; replace it whole below.
    }
  }

  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    enumerable: false,
    writable: true,
    value: { getRandomValues },
  });
}

installGetRandomValues();

// Hermes has had TextEncoder/TextDecoder since RN 0.74, but the Jest
// environment and older runtimes may not. ethers needs both to hash UTF-8
// strings, so fail loudly here rather than deep inside a signing call.
if (typeof globalThis.TextEncoder === 'undefined') {
  throw new Error(
    'TextEncoder is missing from this runtime. Ninja Wallet cannot derive keys safely without it.',
  );
}

/**
 * Sanity check that the runtime actually gave us a working CSPRNG. A silently
 * broken `getRandomValues` (one that returns all zeroes) would make every
 * generated wallet identical and drainable, so we refuse to start instead.
 */
export function assertSecureRandomAvailable(): void {
  const probe = new Uint8Array(32);

  if (typeof globalThis.crypto?.getRandomValues !== 'function') {
    throw new Error('No secure random source available — refusing to generate keys.');
  }

  globalThis.crypto.getRandomValues(probe);

  if (probe.every((byte) => byte === 0)) {
    throw new Error('Secure random source returned all zeroes — refusing to generate keys.');
  }
}
