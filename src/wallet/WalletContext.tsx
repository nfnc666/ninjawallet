import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import type { DerivedAddresses } from './derivation';
import {
  deleteWallet as deleteStoredWallet,
  hasWallet,
  saveWallet,
  unlockWallet,
  type SaveOptions,
} from './keystore';
import { DEFAULT_NETWORK_ID, NETWORKS, type NetworkConfig, type NetworkId } from './networks';

const NETWORK_PREF_KEY = 'ninjawallet.network.v1';

/** Lock the wallet after this long in the background. */
const AUTO_LOCK_MS = 2 * 60 * 1000;

export type WalletStatus = 'loading' | 'no-wallet' | 'locked' | 'unlocked' | 'error';

interface WalletState {
  status: WalletStatus;
  addresses: DerivedAddresses | null;
  network: NetworkConfig;
  /** Why `status` is 'error'. Null in every other state. */
  storageError: string | null;
}

interface WalletActions {
  /** Encrypts and stores a phrase, then leaves the session unlocked. */
  createWallet: (phrase: string, passcode: string, options?: SaveOptions) => Promise<void>;
  unlock: (passcode: string) => Promise<void>;
  lock: () => void;
  /** Wipes the wallet from the device. */
  forgetWallet: () => Promise<void>;
  setNetwork: (id: NetworkId) => Promise<void>;
  /** Re-reads secure storage after an 'error' state. */
  retryLoad: () => void;
  /**
   * Runs `fn` with the decrypted recovery phrase and clears the local
   * reference afterwards. The only sanctioned way to reach the phrase, so
   * signing code never has to hold it in component state.
   */
  withPhrase: <T>(fn: (phrase: string) => Promise<T>) => Promise<T>;
}

type WalletContextValue = WalletState & WalletActions;

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<WalletStatus>('loading');
  const [addresses, setAddresses] = useState<DerivedAddresses | null>(null);
  const [networkId, setNetworkId] = useState<NetworkId>(DEFAULT_NETWORK_ID);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [loadNonce, setLoadNonce] = useState(0);

  // The phrase lives in a ref, not state: it must never be a render input, so
  // it cannot leak into a devtools snapshot or an error boundary's props dump.
  const phraseRef = useRef<string | null>(null);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [exists, savedNetwork] = await Promise.all([
          hasWallet(),
          SecureStore.getItemAsync(NETWORK_PREF_KEY),
        ]);
        if (cancelled) return;

        if (savedNetwork !== null && savedNetwork in NETWORKS) {
          setNetworkId(savedNetwork as NetworkId);
        }
        setStorageError(null);
        setStatus(exists ? 'locked' : 'no-wallet');
      } catch (caught) {
        if (cancelled) return;
        // Never fall through to 'no-wallet' here: if we cannot read secure
        // storage we do not know whether a wallet exists, and sending the user
        // into onboarding would let a new keystore overwrite the old one.
        setStorageError(
          caught instanceof Error ? caught.message : 'Secure storage is unavailable.',
        );
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadNonce]);

  const lock = useCallback(() => {
    phraseRef.current = null;
    setStatus((current) => (current === 'unlocked' ? 'locked' : current));
  }, []);

  // Auto-lock: drop the phrase when the app has been away long enough.
  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next === 'active') {
        const since = backgroundedAt.current;
        backgroundedAt.current = null;
        if (since !== null && Date.now() - since >= AUTO_LOCK_MS) lock();
      } else if (next === 'background' || next === 'inactive') {
        backgroundedAt.current ??= Date.now();
      }
    };

    const subscription = AppState.addEventListener('change', onChange);
    return () => subscription.remove();
  }, [lock]);

  const createWallet = useCallback(
    async (phrase: string, passcode: string, options?: SaveOptions) => {
      const derived = await saveWallet(phrase, passcode, options);
      phraseRef.current = phrase;
      setAddresses(derived);
      setStatus('unlocked');
    },
    [],
  );

  const unlock = useCallback(async (passcode: string) => {
    const { phrase, addresses: derived } = await unlockWallet(passcode);
    phraseRef.current = phrase;
    setAddresses(derived);
    setStatus('unlocked');
  }, []);

  const forgetWallet = useCallback(async () => {
    await deleteStoredWallet();
    phraseRef.current = null;
    setAddresses(null);
    setStatus('no-wallet');
  }, []);

  const setNetwork = useCallback(async (id: NetworkId) => {
    setNetworkId(id);
    await SecureStore.setItemAsync(NETWORK_PREF_KEY, id);
  }, []);

  const withPhrase = useCallback(async <T,>(fn: (phrase: string) => Promise<T>): Promise<T> => {
    const phrase = phraseRef.current;
    if (phrase === null) throw new Error('Wallet is locked.');
    return fn(phrase);
  }, []);

  const retryLoad = useCallback(() => {
    setStatus('loading');
    setStorageError(null);
    setLoadNonce((n) => n + 1);
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({
      status,
      addresses,
      network: NETWORKS[networkId],
      storageError,
      createWallet,
      unlock,
      lock,
      forgetWallet,
      setNetwork,
      withPhrase,
      retryLoad,
    }),
    [
      status,
      addresses,
      networkId,
      storageError,
      createWallet,
      unlock,
      lock,
      forgetWallet,
      setNetwork,
      withPhrase,
      retryLoad,
    ],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const value = useContext(WalletContext);
  if (value === null) throw new Error('useWallet must be used inside a WalletProvider.');
  return value;
}
