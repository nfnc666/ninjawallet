/**
 * Crypto polyfills. This module MUST be imported before anything that touches
 * `ethers`, because ethers' key generation reaches for `crypto.getRandomValues`
 * at call time and Hermes does not ship one.
 *
 * `react-native-get-random-values` installs a CSPRNG backed by the platform
 * (SecRandomCopyBytes on iOS, SecureRandom on Android). Importing it for its
 * side effect is the documented usage.
 */
import 'react-native-get-random-values';

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
