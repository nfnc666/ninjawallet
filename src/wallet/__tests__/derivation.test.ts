import { verifyMessage } from 'ethers';

import {
  deriveBitcoinAddress,
  deriveEvmAddress,
  deriveEvmWallet,
  mnemonicEntropy,
  paths,
} from '../derivation';

/**
 * The BIP-39 "abandon…about" phrase, used as the test vector by BIP-44 and
 * BIP-84. If these addresses ever change, phrases created by this app stop
 * restoring in other wallets — which is the worst bug this codebase can have.
 */
const VECTOR_PHRASE =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

describe('paths', () => {
  it('uses the registered BIP-44 path for EVM accounts', () => {
    expect(paths.evm(0)).toBe("m/44'/60'/0'/0/0");
    expect(paths.evm(3)).toBe("m/44'/60'/0'/0/3");
  });

  it('uses the registered BIP-84 path for native SegWit Bitcoin', () => {
    expect(paths.bitcoin(0)).toBe("m/84'/0'/0'/0/0");
  });
});

describe('deriveEvmAddress', () => {
  // Vector from the BIP-44 / MetaMask default path for the abandon phrase.
  it('matches the known address at index 0', () => {
    expect(deriveEvmAddress(VECTOR_PHRASE, 0)).toBe(
      '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    );
  });

  it('matches the known address at index 1', () => {
    expect(deriveEvmAddress(VECTOR_PHRASE, 1)).toBe(
      '0x6Fac4D18c912343BF86fa7049364Dd4E424Ab9C0',
    );
  });

  it('gives every index a distinct address', () => {
    const addresses = [0, 1, 2, 3].map((i) => deriveEvmAddress(VECTOR_PHRASE, i));
    expect(new Set(addresses).size).toBe(addresses.length);
  });

  it('is deterministic for the same phrase', () => {
    expect(deriveEvmAddress(VECTOR_PHRASE)).toBe(deriveEvmAddress(VECTOR_PHRASE));
  });
});

describe('deriveBitcoinAddress', () => {
  // Vectors are quoted verbatim from BIP-84's "Test vectors" section.
  it('matches BIP-84 account 0, first receiving address', () => {
    expect(deriveBitcoinAddress(VECTOR_PHRASE, 0)).toBe(
      'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu',
    );
  });

  it('matches BIP-84 account 0, second receiving address', () => {
    expect(deriveBitcoinAddress(VECTOR_PHRASE, 1)).toBe(
      'bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g',
    );
  });

  it('produces a tb1 address on testnet', () => {
    const address = deriveBitcoinAddress(VECTOR_PHRASE, 0, 'testnet');
    expect(address.startsWith('tb1')).toBe(true);
  });

  it('produces a 42-character P2WPKH address', () => {
    expect(deriveBitcoinAddress(VECTOR_PHRASE, 0)).toHaveLength(42);
  });
});

describe('deriveEvmWallet', () => {
  it('derives a key that signs recoverably', async () => {
    const wallet = deriveEvmWallet(VECTOR_PHRASE, 0);
    const signature = await wallet.signMessage('ninja');
    expect(verifyMessage('ninja', signature)).toBe(wallet.address);
  });
});

describe('mnemonicEntropy', () => {
  it('round-trips the all-zero entropy of the test vector', () => {
    expect(mnemonicEntropy(VECTOR_PHRASE)).toBe(`0x${'00'.repeat(16)}`);
  });
});
