/**
 * The CSPRNG polyfill. Every key this wallet generates comes out of it, so a
 * silent failure here is the worst bug the codebase can have: identical or
 * predictable wallets that anyone can drain.
 */

const mockRandom = { fill: (bytes: Uint8Array) => bytes.fill(7) };

jest.mock('expo-crypto', () => ({
  getRandomValues: (bytes: Uint8Array) => mockRandom.fill(bytes),
}));

const realCrypto = globalThis.crypto;

afterEach(() => {
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: realCrypto });
  mockRandom.fill = (bytes: Uint8Array) => bytes.fill(7);
  jest.resetModules();
});

function loadInto(crypto: unknown) {
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: crypto });
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../polyfills') as typeof import('../polyfills');
}

describe('installing getRandomValues', () => {
  it('installs one on a runtime that has none, as Hermes does', () => {
    loadInto(undefined);
    const probe = new Uint8Array(4);
    globalThis.crypto.getRandomValues(probe);
    expect(Array.from(probe)).toEqual([7, 7, 7, 7]);
  });

  it('fills in a crypto object that exists but cannot random', () => {
    loadInto({ subtle: {} });
    expect(typeof globalThis.crypto.getRandomValues).toBe('function');
    // Whatever else the runtime put there is left alone.
    expect(globalThis.crypto).toHaveProperty('subtle');
  });

  it('replaces a frozen crypto object rather than giving up', () => {
    loadInto(Object.freeze({}));
    expect(typeof globalThis.crypto.getRandomValues).toBe('function');
  });

  it('leaves a runtime that already has a real one alone', () => {
    // Node under Jest, or a browser: its own CSPRNG is the better source.
    const own = jest.fn();
    loadInto({ getRandomValues: own });
    expect(globalThis.crypto.getRandomValues).toBe(own);
  });
});

describe('assertSecureRandomAvailable', () => {
  it('passes when the source produces bytes', () => {
    const { assertSecureRandomAvailable } = loadInto(undefined);
    expect(() => assertSecureRandomAvailable()).not.toThrow();
  });

  it('refuses to run when the source returns all zeroes', () => {
    // A broken generator would make every wallet identical and drainable, so
    // the app stops instead of quietly issuing keys nobody owns alone.
    mockRandom.fill = (bytes: Uint8Array) => bytes.fill(0);
    const { assertSecureRandomAvailable } = loadInto(undefined);
    expect(() => assertSecureRandomAvailable()).toThrow(/zeroes/i);
  });

  it('refuses when there is no source at all', () => {
    const { assertSecureRandomAvailable } = loadInto(undefined);
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: {} });
    expect(() => assertSecureRandomAvailable()).toThrow(/no secure random/i);
  });
});
