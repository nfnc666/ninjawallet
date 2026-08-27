import { parsePaymentCode, UnreadablePaymentCodeError } from '../paymentUri';

const EVM = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94';
const BTC = 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu';

describe('bare addresses', () => {
  it('reads a plain Ethereum address', () => {
    expect(parsePaymentCode(EVM)).toEqual({
      chain: 'evm',
      address: EVM,
      amount: null,
      chainId: null,
    });
  });

  it('checksums a lowercase Ethereum address', () => {
    expect(parsePaymentCode(EVM.toLowerCase()).address).toBe(EVM);
  });

  it('reads a plain Bitcoin address', () => {
    expect(parsePaymentCode(BTC)).toMatchObject({ chain: 'bitcoin', address: BTC });
  });

  it('reads a legacy Bitcoin address', () => {
    expect(parsePaymentCode('1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA').chain).toBe('bitcoin');
  });

  it('ignores surrounding whitespace', () => {
    expect(parsePaymentCode(`  ${EVM}  `).address).toBe(EVM);
  });
});

describe('EIP-681', () => {
  it('reads an address with a scheme', () => {
    expect(parsePaymentCode(`ethereum:${EVM}`)).toMatchObject({ chain: 'evm', address: EVM });
  });

  it('reads the chain id', () => {
    expect(parsePaymentCode(`ethereum:${EVM}@1`).chainId).toBe(1);
  });

  it('reads a requested amount', () => {
    expect(parsePaymentCode(`ethereum:${EVM}@1?value=0.5`).amount).toBe('0.5');
  });

  it('tolerates the pay- prefix', () => {
    expect(parsePaymentCode(`ethereum:pay-${EVM}`).address).toBe(EVM);
  });

  it('refuses a contract call rather than reading it as a plain transfer', () => {
    // `…/transfer` moves a token. Treating it as a transfer would send ether
    // to the token contract instead.
    expect(() => parsePaymentCode(`ethereum:${EVM}/transfer?address=${EVM}&uint256=1`)).toThrow(
      /contract call/i,
    );
  });

  it('refuses a malformed address', () => {
    expect(() => parsePaymentCode('ethereum:0xdead')).toThrow(/valid Ethereum address/i);
  });

  it('refuses a nonsensical chain id', () => {
    expect(() => parsePaymentCode(`ethereum:${EVM}@abc`)).toThrow(/chain/i);
    expect(() => parsePaymentCode(`ethereum:${EVM}@-1`)).toThrow(/chain/i);
  });

  it('drops an amount that is not a plain decimal', () => {
    // Never carry through something the amount field cannot parse.
    expect(parsePaymentCode(`ethereum:${EVM}?value=1e18`).amount).toBeNull();
    expect(parsePaymentCode(`ethereum:${EVM}?value=abc`).amount).toBeNull();
  });
});

describe('BIP-21', () => {
  it('reads an address with a scheme', () => {
    expect(parsePaymentCode(`bitcoin:${BTC}`)).toMatchObject({ chain: 'bitcoin', address: BTC });
  });

  it('reads a requested amount', () => {
    expect(parsePaymentCode(`bitcoin:${BTC}?amount=0.25&label=Coffee`).amount).toBe('0.25');
  });

  it('refuses a malformed address', () => {
    expect(() => parsePaymentCode('bitcoin:not-an-address')).toThrow(/valid Bitcoin address/i);
  });
});

describe('rejections', () => {
  it('refuses an empty code', () => {
    expect(() => parsePaymentCode('   ')).toThrow(/empty/i);
  });

  it('names an unsupported scheme rather than guessing', () => {
    expect(() => parsePaymentCode('solana:abc123')).toThrow(/solana/i);
  });

  it('refuses a plain URL', () => {
    expect(() => parsePaymentCode('https://example.test/pay')).toThrow(
      UnreadablePaymentCodeError,
    );
  });

  it('refuses arbitrary text that merely contains an address', () => {
    // Picking the address out of surrounding text risks lifting a different
    // address than the payload actually means.
    expect(() => parsePaymentCode(`Send to ${EVM} please`)).toThrow(UnreadablePaymentCodeError);
  });

  it('refuses a code with no address at all', () => {
    expect(() => parsePaymentCode('hello world')).toThrow(/does not contain an address/i);
  });
});
