import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { parseEther } from 'ethers';

/**
 * Smoke tests for the screens behind the lock. They cannot be reached in a
 * browser — the wallet refuses to run without a device keychain — so without
 * these they would ship having never been rendered once.
 *
 * Each test asserts on visible text, so a screen that renders but shows the
 * wrong figure still fails.
 */

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockParams = { symbol: 'SepoliaETH' };
const mockWallet = {
  status: 'unlocked' as const,
  addresses: {
    evm: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    bitcoin: 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu',
  },
  storageError: null,
  withPhrase: jest.fn(),
  lock: jest.fn(),
  forgetWallet: jest.fn(),
  setNetwork: jest.fn(),
  unlock: jest.fn(),
  createWallet: jest.fn(),
  retryLoad: jest.fn(),
  network: jest.requireActual('@/wallet/networks').NETWORKS.sepolia,
};
const mockBalance = { value: parseEther('1.5'), loading: false, error: null, refresh: jest.fn() };

jest.mock('expo-router', () => ({
  router: mockRouter,
  useLocalSearchParams: () => mockParams,
  Redirect: () => null,
  Stack: { Screen: () => null },
  Tabs: Object.assign(() => null, { Screen: () => null }),
}));

jest.mock('@/wallet/WalletContext', () => ({
  useWallet: () => mockWallet,
  WalletProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/wallet/useBalance', () => ({ useBalance: () => mockBalance }));

jest.mock('react-native-qrcode-svg', () => 'QRCode');

// The real icon set loads its font asynchronously, which fires a setState
// outside act() and buries the output in warnings. The glyphs are not what
// these tests are checking.
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

/**
 * Every string rendered anywhere in the tree.
 *
 * Fragments inside one <Text> are joined without a separator — interpolation
 * splits `{amount} {symbol} available` into separate children, and a test
 * looking for that whole phrase should still find it. Separate elements are
 * joined with a delimiter so unrelated labels cannot run together.
 */
function textOf(root: ReactTestInstance): string {
  return root
    .findAllByType('Text' as never, { deep: true })
    .map((node) =>
      node.children.filter((child): child is string => typeof child === 'string').join(''),
    )
    .filter((line) => line.trim() !== '')
    .join(' | ');
}

function render(Screen: React.ComponentType) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<Screen />);
  });
  return tree;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams.symbol = 'SepoliaETH';
  mockBalance.value = parseEther('1.5');
  mockBalance.error = null;
});

describe('portfolio', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Portfolio = () => require('../(wallet)/index').default();

  it('shows the live balance and the network it belongs to', () => {
    const tree = render(Portfolio as React.ComponentType);
    const text = textOf(tree.root);
    expect(text).toContain('1.5 SepoliaETH');
    expect(text).toContain('Sepolia Testnet');
  });

  it('labels a testnet balance as not real money', () => {
    const text = textOf(render(Portfolio as React.ComponentType).root);
    expect(text).toMatch(/not real money/i);
  });

  it('lists Bitcoin as receive-only rather than showing a balance for it', () => {
    const text = textOf(render(Portfolio as React.ComponentType).root);
    expect(text).toContain('Bitcoin');
    expect(text).toContain('Receive only');
  });

  it('shows a dash, not a zero, when the node could not be reached', () => {
    mockBalance.value = null as never;
    mockBalance.error = 'Network request failed' as never;
    const text = textOf(render(Portfolio as React.ComponentType).root);
    expect(text).toContain('Network request failed');
    // A failed read must never read as an empty wallet.
    expect(text).not.toContain('0 SepoliaETH');
  });
});

describe('receive', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Receive = () => require('../receive/[symbol]').default();

  it('shows the EVM address for the native coin', () => {
    const text = textOf(render(Receive as React.ComponentType).root);
    expect(text).toContain(mockWallet.addresses.evm);
  });

  it('shows the Bitcoin address — not the EVM one — for BTC', () => {
    mockParams.symbol = 'BTC';
    const text = textOf(render(Receive as React.ComponentType).root);
    expect(text).toContain(mockWallet.addresses.bitcoin);
    expect(text).not.toContain(mockWallet.addresses.evm);
  });

  it('warns that a testnet address is not the mainnet one', () => {
    const text = textOf(render(Receive as React.ComponentType).root);
    expect(text).toMatch(/only send test coins/i);
  });
});

describe('send', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Send = () => require('../send/[symbol]').default();

  it('offers the transfer form for the native coin', () => {
    const text = textOf(render(Send as React.ComponentType).root);
    expect(text).toContain('Recipient address');
    expect(text).toContain('1.5 SepoliaETH available');
  });

  it('refuses a Bitcoin send instead of showing a form that cannot work', () => {
    mockParams.symbol = 'BTC';
    const text = textOf(render(Send as React.ComponentType).root);
    expect(text).toMatch(/cannot build BTC transactions/i);
    expect(text).not.toContain('Recipient address');
  });
});

describe('coin detail', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Coin = () => require('../coin/[symbol]').default();

  it('shows the balance for the native coin', () => {
    const text = textOf(render(Coin as React.ComponentType).root);
    expect(text).toContain('1.5 SepoliaETH');
  });

  it('says history is not indexed rather than showing an empty list', () => {
    const text = textOf(render(Coin as React.ComponentType).root);
    expect(text).toMatch(/not indexed/i);
  });

  it('marks Bitcoin as receive-only and shows no balance for it', () => {
    mockParams.symbol = 'BTC';
    const text = textOf(render(Coin as React.ComponentType).root);
    expect(text).toContain('— BTC');
    expect(text).toMatch(/receive-only/i);
  });
});
