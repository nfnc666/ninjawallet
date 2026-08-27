import * as SecureStore from 'expo-secure-store';
import {
  HDNodeWallet,
  Mnemonic,
  decryptKeystoreJson,
  encryptKeystoreJson,
  isKeystoreJson,
} from 'ethers';

import { deriveAddresses, mnemonicEntropy, paths, type DerivedAddresses } from './derivation';
import { normalizeMnemonic } from './mnemonic';

const KEYSTORE_KEY = 'ninjawallet.keystore.v1';

/**
 * scrypt work factor for the PIN-derived key.
 *
 * ethers defaults to N=2^18, which takes minutes in JavaScript on a phone. We
 * lower it to 2^15 (~0.3s on a mid-range device) and lean on the fact that the
 * ciphertext lives in hardware-backed storage (iOS Keychain / Android Keystore),
 * so an attacker needs physical access AND a compromised device before the work
 * factor matters at all. Users who want a stronger offline margin should choose
 * a passphrase rather than a 6-digit PIN — see MIN_PASSCODE_LENGTH.
 */
const SCRYPT_N = 1 << 15;

/** Shortest passcode we accept. Six digits matches the phone-unlock habit. */
export const MIN_PASSCODE_LENGTH = 6;

export interface UnlockedWallet {
  /** The recovery phrase. Hold it only as long as the session needs it. */
  phrase: string;
  addresses: DerivedAddresses;
}

export class WrongPasscodeError extends Error {
  constructor() {
    super('Wrong passcode.');
    this.name = 'WrongPasscodeError';
  }
}

export class NoWalletError extends Error {
  constructor() {
    super('No wallet has been created on this device yet.');
    this.name = 'NoWalletError';
  }
}

/** True when this device holds an encrypted wallet. */
export async function hasWallet(): Promise<boolean> {
  return (await SecureStore.getItemAsync(KEYSTORE_KEY)) !== null;
}

export interface SaveOptions {
  /**
   * Gate reads behind device biometrics / passcode. Requires the device to
   * actually have them enrolled, so callers should fall back when this throws.
   */
  requireAuthentication?: boolean;
  /** Progress callback for the scrypt run, 0…1. */
  onProgress?: (fraction: number) => void;
}

/**
 * Encrypts a recovery phrase under `passcode` and writes it to hardware-backed
 * storage. Overwrites any existing wallet, so callers must confirm first.
 */
export async function saveWallet(
  phrase: string,
  passcode: string,
  options: SaveOptions = {},
): Promise<DerivedAddresses> {
  const normalized = normalizeMnemonic(phrase);
  assertPasscode(passcode);

  if (!Mnemonic.isValidMnemonic(normalized)) {
    throw new Error('Refusing to store an invalid recovery phrase.');
  }

  const account = HDNodeWallet.fromPhrase(normalized, undefined, paths.evm(0));

  const json = await encryptKeystoreJson(
    {
      address: account.address,
      privateKey: account.privateKey,
      mnemonic: {
        entropy: mnemonicEntropy(normalized),
        path: paths.evm(0),
        locale: 'en',
      },
    },
    passcode,
    { scrypt: { N: SCRYPT_N }, progressCallback: options.onProgress },
  );

  await SecureStore.setItemAsync(KEYSTORE_KEY, json, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    requireAuthentication: options.requireAuthentication ?? false,
  });

  return deriveAddresses(normalized);
}

/**
 * Decrypts the stored wallet. Throws {@link WrongPasscodeError} on a bad
 * passcode and {@link NoWalletError} when nothing is stored.
 */
export async function unlockWallet(
  passcode: string,
  onProgress?: (fraction: number) => void,
): Promise<UnlockedWallet> {
  const json = await SecureStore.getItemAsync(KEYSTORE_KEY);
  if (json === null) throw new NoWalletError();
  if (!isKeystoreJson(json)) {
    throw new Error('Stored wallet is corrupt. Restore from your recovery phrase.');
  }

  let account;
  try {
    account = await decryptKeystoreJson(json, passcode, onProgress);
  } catch (error) {
    // ethers reports a bad password as an "invalid password" error; anything
    // else is a real fault we should not mask as a typo.
    if (isInvalidPasswordError(error)) throw new WrongPasscodeError();
    throw error;
  }

  // decryptKeystoreJson hands back a KeystoreAccount, which carries the
  // mnemonic as entropy rather than words — rebuild the phrase from it.
  const entropy = account.mnemonic?.entropy;
  if (entropy === undefined) {
    throw new Error('Stored wallet has no recovery phrase attached.');
  }

  const phrase = Mnemonic.fromEntropy(entropy).phrase;
  return { phrase, addresses: deriveAddresses(phrase) };
}

/**
 * Wipes the wallet from this device. Irreversible without the recovery phrase —
 * the caller is responsible for warning the user first.
 */
export async function deleteWallet(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYSTORE_KEY);
}

function assertPasscode(passcode: string): void {
  if (passcode.length < MIN_PASSCODE_LENGTH) {
    throw new Error(`Passcode must be at least ${MIN_PASSCODE_LENGTH} characters.`);
  }
}

function isInvalidPasswordError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /incorrect password|invalid password/i.test(message);
}
