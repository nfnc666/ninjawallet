import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { useWallet, WalletProvider, type WalletStatus } from '../WalletContext';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'whenUnlockedThisDeviceOnly',
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SecureStore = require('expo-secure-store') as {
  getItemAsync: jest.Mock;
};

/** Renders the provider and reports whatever status it settles on. */
function Probe({ onStatus }: { onStatus: (status: WalletStatus) => void }) {
  const { status } = useWallet();
  onStatus(status);
  return <Text>{status}</Text>;
}

async function renderProvider(): Promise<WalletStatus[]> {
  const seen: WalletStatus[] = [];
  await act(async () => {
    TestRenderer.create(
      <WalletProvider>
        <Probe onStatus={(status) => seen.push(status)} />
      </WalletProvider>,
    );
  });
  return seen;
}

describe('WalletProvider startup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports no-wallet when secure storage is empty', async () => {
    SecureStore.getItemAsync.mockResolvedValue(null);
    const seen = await renderProvider();
    expect(seen.at(-1)).toBe('no-wallet');
  });

  it('reports locked when a keystore is present', async () => {
    SecureStore.getItemAsync.mockImplementation(async (key: string) =>
      key.includes('keystore') ? '{"version":3}' : null,
    );
    const seen = await renderProvider();
    expect(seen.at(-1)).toBe('locked');
  });

  it('reports error — never no-wallet — when secure storage throws', async () => {
    // The dangerous regression: falling through to 'no-wallet' would walk the
    // user into onboarding, where saving would overwrite an existing keystore.
    SecureStore.getItemAsync.mockRejectedValue(new Error('Keychain unavailable'));
    const seen = await renderProvider();
    expect(seen.at(-1)).toBe('error');
    expect(seen).not.toContain('no-wallet');
  });

  it('starts in loading before storage answers', async () => {
    SecureStore.getItemAsync.mockResolvedValue(null);
    const seen = await renderProvider();
    expect(seen[0]).toBe('loading');
  });
});
