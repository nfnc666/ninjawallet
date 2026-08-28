import React, { useEffect } from 'react';
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

// Babel checks mock factories statically and only allows `mock`-prefixed
// names from module scope, hence the alias.
const mockUseEffect = useEffect;

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
const mockChart = {
  series: null as unknown,
  loading: false,
  error: null as string | null,
  refresh: jest.fn(),
};
const mockHistory = {
  entries: [] as unknown[],
  loading: false,
  error: null as string | null,
  refresh: jest.fn(),
};

jest.mock('expo-router', () => ({
  router: mockRouter,
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void) => mockUseEffect(effect, [effect]),
  Redirect: () => null,
  Stack: { Screen: () => null },
  Tabs: Object.assign(() => null, { Screen: () => null }),
}));

jest.mock('@/wallet/WalletContext', () => ({
  useWallet: () => mockWallet,
  WalletProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/wallet/useBalance', () => ({ useBalance: () => mockBalance }));

jest.mock('@/wallet/useHistory', () => ({ useHistory: () => mockHistory }));

jest.mock('@/wallet/usePriceSeries', () => ({ usePriceSeries: () => mockChart }));

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
  mockHistory.entries = [];
  mockHistory.error = null;
  mockHistory.loading = false;
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

  it('never shows a dollar figure on a testnet', () => {
    // Sepolia ether does not trade. Any fiat number here would be invented.
    const text = textOf(render(Portfolio as React.ComponentType).root);
    expect(text).not.toContain('$');
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

  it('offers a scan button, so an address never has to be typed', () => {
    const tree = render(Send as React.ComponentType);
    expect(
      tree.root.findAllByProps({ accessibilityLabel: 'Scan a QR code' }).length,
    ).toBeGreaterThan(0);
  });

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

  it('says the list is empty rather than showing nothing at all', () => {
    const text = textOf(render(Coin as React.ComponentType).root);
    expect(text).toMatch(/no transactions yet/i);
  });

  it('surfaces a history failure instead of showing it as an empty history', () => {
    mockHistory.error = 'Explorer returned 500.';
    const text = textOf(render(Coin as React.ComponentType).root);
    expect(text).toContain('Explorer returned 500.');
    expect(text).not.toMatch(/no transactions yet/i);
  });

  it('lists transactions when there are some', () => {
    mockHistory.entries = [
      {
        hash: '0xabc',
        direction: 'out',
        value: parseEther('0.25'),
        counterparty: '0x6Fac4D18c912343BF86fa7049364Dd4E424Ab9C0',
        timestamp: new Date(Date.now() - 120_000),
        succeeded: true,
        fee: 1n,
      },
    ];
    const text = textOf(render(Coin as React.ComponentType).root);
    expect(text).toContain('Sent');
    expect(text).toContain('0.25 SepoliaETH');
  });

  it('marks Bitcoin as receive-only and shows no balance for it', () => {
    mockParams.symbol = 'BTC';
    const text = textOf(render(Coin as React.ComponentType).root);
    expect(text).toContain('— BTC');
    expect(text).toMatch(/receive-only/i);
  });
});
