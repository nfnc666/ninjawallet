import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';

import { Button } from '@/components';
import { useWallet } from '@/wallet/WalletContext';
import { colors, layout, spacing, typography } from '@/theme';

/**
 * Entry gate. Sends the user to onboarding, the unlock screen, or the wallet
 * depending on what is stored on the device.
 */
export default function Index() {
  const { status, storageError, retryLoad } = useWallet();

  if (status === 'loading') {
    return (
      <View style={styles.centre}>
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={[styles.centre, styles.padded]}>
        <Text style={styles.title}>Secure storage is unavailable</Text>
        <Text style={styles.body}>
          Ninja Wallet keeps your key in the device keychain and cannot start without it. It does
          not fall back to ordinary storage, because that would leave your key readable.
        </Text>
        {storageError !== null ? <Text style={styles.detail}>{storageError}</Text> : null}
        <Button label="Try again" onPress={retryLoad} style={styles.retry} />
      </View>
    );
  }

  if (status === 'no-wallet') return <Redirect href="/(onboarding)/welcome" />;
  if (status === 'locked') return <Redirect href="/(onboarding)/unlock" />;
  return <Redirect href="/(wallet)" />;
}

const styles = StyleSheet.create({
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    backgroundColor: colors.background,
  },
  padded: {
    paddingHorizontal: layout.screenPadding,
  },
  title: {
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
  },
  body: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
  },
  detail: {
    ...typography.caption,
    color: colors.negative,
    textAlign: 'center',
  },
  retry: {
    alignSelf: 'stretch',
    marginTop: spacing.lg,
  },
});
