import { bech32 } from 'bech32';
import { HDNodeWallet, Mnemonic, getBytes, ripemd160, sha256 } from 'ethers';

/**
 * Derivation paths. Both are the standard registered paths for their chain, so
 * a phrase created here restores correctly in other wallets (and vice versa).
 */
export const paths = {
  /** BIP-44, Ethereum and every EVM chain. */
  evm: (index = 0) => `m/44'/60'/0'/0/${index}`,
  /** BIP-84, native SegWit Bitcoin (bc1… addresses). */
  bitcoin: (index = 0) => `m/84'/0'/0'/0/${index}`,
} as const;

/** Bitcoin human-readable part: `bc` for mainnet, `tb` for testnet. */
export type BitcoinNetwork = 'mainnet' | 'testnet';

const BITCOIN_HRP: Record<BitcoinNetwork, string> = {
  mainnet: 'bc',
  testnet: 'tb',
};

/**
 * Derives the EVM account at `index` from a recovery phrase.
 *
 * The returned wallet holds a private key in memory — keep it inside the call
 * that needs it and never put it in state, a log line, or a render tree.
 */
export function deriveEvmWallet(phrase: string, index = 0): HDNodeWallet {
  return HDNodeWallet.fromPhrase(phrase, undefined, paths.evm(index));
}

/** Derives just the EVM address, without keeping a key around. */
export function deriveEvmAddress(phrase: string, index = 0): string {
  return deriveEvmWallet(phrase, index).address;
}

/**
 * Derives a native SegWit (P2WPKH) Bitcoin address at `index`.
 *
 * The witness program is HASH160 of the compressed public key, encoded as
 * bech32 with witness version 0 — BIP-141 and BIP-173.
 */
export function deriveBitcoinAddress(
  phrase: string,
  index = 0,
  network: BitcoinNetwork = 'mainnet',
): string {
  const node = HDNodeWallet.fromPhrase(phrase, undefined, paths.bitcoin(index));
  const publicKey = getBytes(node.signingKey.compressedPublicKey);
  const witnessProgram = getBytes(ripemd160(sha256(publicKey)));

  return bech32.encode(BITCOIN_HRP[network], [0, ...bech32.toWords(witnessProgram)]);
}

/**
 * Every address a phrase controls, for the account index we expose in the UI.
 * Bitcoin is derive-and-receive only for now — see `transfer.ts`.
 */
export interface DerivedAddresses {
  evm: string;
  bitcoin: string;
}

export function deriveAddresses(
  phrase: string,
  index = 0,
  bitcoinNetwork: BitcoinNetwork = 'mainnet',
): DerivedAddresses {
  return {
    evm: deriveEvmAddress(phrase, index),
    bitcoin: deriveBitcoinAddress(phrase, index, bitcoinNetwork),
  };
}

/** Entropy behind a phrase, used when writing an encrypted keystore. */
export function mnemonicEntropy(phrase: string): string {
  return Mnemonic.fromPhrase(phrase).entropy;
}
