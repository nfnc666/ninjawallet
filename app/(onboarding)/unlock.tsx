import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Button, NinjaLogo, ScreenBackground, TextField } from '@/components';
import { WrongPasscodeError } from '@/wallet/keystore';
import { useWallet } from '@/wallet/WalletContext';
import { colors, spacing, typography } from '@/theme';

/**
 * figma 249:2834 — the sign-in screen, reworked: this wallet has no account to
 * sign into, so the same layout unlocks the local keystore instead.
 */
export default function Unlock() {
  const { unlock, forgetWallet } = useWallet();
  const [passcode, setPasscode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUnlock = async () => {
    setBusy(true);
    setError(null);
    try {
      await unlock(passcode);
      router.replace('/(wallet)');
    } catch (caught) {
      setError(
        caught instanceof WrongPasscodeError
          ? 'Wrong passcode.'
          : caught instanceof Error
            ? caught.message
            : 'Could not unlock the wallet.',
      );
      setBusy(false);
    }
  };

  const handleForget = () => {
    Alert.alert(
      'Erase this wallet?',
      'The encrypted key is deleted from this device. Without your recovery phrase the funds are gone for good.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase',
          style: 'destructive',
          onPress: async () => {
            await forgetWallet();
            router.replace('/(onboarding)/welcome');
          },
        },
      ],
    );
  };

  return (
    <ScreenBackground glow>
      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.brand}>
          <NinjaLogo size={96} />
          <Text style={styles.wordmark}>Ninja Wallet</Text>
        </View>

        <TextField
          label="Passcode"
          icon="lock-closed-outline"
          value={passcode}
          onChangeText={(text) => {
            setPasscode(text);
            setError(null);
          }}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          textContentType="password"
          placeholder="Enter your passcode"
          onSubmitEditing={handleUnlock}
          returnKeyType="go"
          error={error ?? undefined}
        />

        <Button
          label="Unlock"
          loading={busy}
          disabled={passcode.length === 0}
          onPress={handleUnlock}
        />
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <Button label="Erase and start over" variant="ghost" onPress={handleForget} />
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.xl,
  },
  brand: {
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  wordmark: {
    ...typography.headline,
    color: colors.text,
  },
  footer: {
    paddingBottom: spacing.xl,
  },
});
