import type { PaymentRequest } from './paymentUri';

/**
 * Hands a scanned payment request back to the screen that opened the scanner.
 *
 * A module-level slot rather than a router param, for the same reason the
 * recovery phrase is: params end up in deep-link URLs and navigation state. An
 * address there is not a secret, but it is user data, and there is no reason
 * to leave it lying around in a URL.
 *
 * Read once and cleared, so a stale scan can never be applied to a later send.
 */
let pending: PaymentRequest | null = null;

export function setScannedPayment(request: PaymentRequest): void {
  pending = request;
}

/** Returns the pending scan and clears it. */
export function takeScannedPayment(): PaymentRequest | null {
  const value = pending;
  pending = null;
  return value;
}

export function clearScannedPayment(): void {
  pending = null;
}
