import {
  generateMnemonic,
  isValidMnemonic,
  normalizeMnemonic,
  pickVerificationIndices,
  type EntropySource,
} from '../mnemonic';

/** Feeds a fixed byte pattern so a generated phrase is reproducible. */
const fixedEntropy =
  (hex: string): EntropySource =>
  async (byteCount) => {
    const bytes = Uint8Array.from(Buffer.from(hex, 'hex'));
    if (bytes.length !== byteCount) {
      throw new Error(`test entropy is ${bytes.length} bytes, asked for ${byteCount}`);
    }
    return bytes;
  };

describe('generateMnemonic', () => {
  // Vectors from the BIP-39 reference test suite.
  it('matches the BIP-39 vector for 0x7f… entropy', async () => {
    const phrase = await generateMnemonic(12, fixedEntropy('7f'.repeat(16)));
    expect(phrase).toBe(
      'legal winner thank year wave sausage worth useful legal winner thank yellow',
    );
  });

  it('matches the BIP-39 vector for 0x80… entropy', async () => {
    const phrase = await generateMnemonic(12, fixedEntropy('80'.repeat(16)));
    expect(phrase).toBe(
      'letter advice cage absurd amount doctor acoustic avoid letter advice cage above',
    );
  });

  it('matches the BIP-39 vector for 0xff… entropy', async () => {
    const phrase = await generateMnemonic(12, fixedEntropy('ff'.repeat(16)));
    expect(phrase).toBe('zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong');
  });

  it('produces 24 words from 32 bytes of entropy', async () => {
    const phrase = await generateMnemonic(24, fixedEntropy('7f'.repeat(32)));
    expect(phrase.split(' ')).toHaveLength(24);
  });

  it('refuses an all-zero entropy source', async () => {
    await expect(generateMnemonic(12, fixedEntropy('00'.repeat(16)))).rejects.toThrow(
      /all zeroes/i,
    );
  });

  it('refuses an entropy source that returns the wrong length', async () => {
    const short: EntropySource = async () => new Uint8Array(8).fill(1);
    await expect(generateMnemonic(12, short)).rejects.toThrow(/wrong number of bytes/i);
  });

  it('generates a valid phrase every time', async () => {
    const phrase = await generateMnemonic(12, fixedEntropy('a1b2c3d4'.repeat(4)));
    expect(isValidMnemonic(phrase)).toBe(true);
  });
});

describe('isValidMnemonic', () => {
  const valid = 'legal winner thank year wave sausage worth useful legal winner thank yellow';

  it('accepts a valid phrase', () => {
    expect(isValidMnemonic(valid)).toBe(true);
  });

  it('accepts a phrase with stray whitespace and capitals', () => {
    expect(isValidMnemonic(`  LEGAL  winner thank year wave sausage
      worth useful legal winner thank yellow `)).toBe(true);
  });

  it('rejects a phrase whose checksum is wrong', () => {
    // Same words, last one swapped — a checksum failure, not a wordlist one.
    expect(
      isValidMnemonic('legal winner thank year wave sausage worth useful legal winner thank zoo'),
    ).toBe(false);
  });

  it('rejects a word that is not in the wordlist', () => {
    expect(
      isValidMnemonic('legal winner thank year wave sausage worth useful legal winner thank ninja'),
    ).toBe(false);
  });

  it('rejects the wrong number of words', () => {
    expect(isValidMnemonic('legal winner thank year')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidMnemonic('')).toBe(false);
  });
});

describe('normalizeMnemonic', () => {
  it('lowercases, trims and collapses whitespace', () => {
    expect(normalizeMnemonic('  Legal   WINNER\n thank  ')).toBe('legal winner thank');
  });
});

describe('pickVerificationIndices', () => {
  it('returns the requested number of distinct in-range indices', async () => {
    const indices = await pickVerificationIndices(12, 3, fixedByteSequence());
    expect(indices).toHaveLength(3);
    expect(new Set(indices).size).toBe(3);
    indices.forEach((index) => {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(12);
    });
  });

  it('returns them in ascending order', async () => {
    const indices = await pickVerificationIndices(12, 3, fixedByteSequence());
    expect([...indices].sort((a, b) => a - b)).toEqual(indices);
  });

  it('never asks for more indices than there are words', async () => {
    const indices = await pickVerificationIndices(2, 5, fixedByteSequence());
    expect(indices).toHaveLength(2);
  });
});

/** Cycles through byte values so the rejection sampler terminates. */
function fixedByteSequence(): EntropySource {
  let next = 0;
  return async () => new Uint8Array([next++ % 256]);
}
