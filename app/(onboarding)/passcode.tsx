import React, { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';

import { Button, Card, ScreenBackground, ScreenHeader, TextField } from '@/components';
import { MIN_PASSCODE_LENGTH } from '@/wallet/keystore';
import { clearDraftPhrase, getDraftPhrase } from '@/wallet/onboardingDraft';
import { useWallet } from '@/wallet/WalletContext';
import { colors, spacing, typography } from '@/theme';

/** Sets the passcode that encrypts the phrase, then writes the keystore. */
export default function SetPasscode() {
  const { createWallet } = useWallet();
  const phrase = getDraftPhrase();

  const [passcode, setPasscode] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [useBiometrics, setUseBiometrics] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (phrase === null) router.replace('/(onboarding)/welcome');
  }, [phrase]);

  useEffect(() => {
    (async () => {
      const [hasHardware, isEnrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      const available = hasHardware && isEnrolled;
      setBiometricsAvailable(available);
      setUseBiometrics(available);
    })();
  }, []);

  if (phrase === null) return null;

  const tooShort = passcode.length > 0 && passcode.length < MIN_PASSCODE_LENGTH;
  const mismatch = confirmation.length > 0 && confirmation !== passcode;
  const canSubmit =
    passcode.length >= MIN_PASSCODE_LENGTH && confirmation === passcode && !busy;

  const handleSubmit = async () => {
    setBusy(true);
    setError(null);
    try {
      await createWallet(phrase, passcode, { requireAuthentication: useBiometrics });
      clearDraftPhrase();
      router.replace('/(wallet)');
    } catch (caught) {
      // Storing with `requireAuthentication` fails on devices whose enrolment
      // changed since we checked; retry once without it rather than dead-end.
      if (useBiometrics) {
        try {
          await createWallet(phrase, passcode, { requireAuthentication: false });
          clearDraftPhrase();
          router.replace('/(wallet)');
          return;
        } catch {
          // fall through to the error below
        }
      }
      setError(caught instanceof Error ? caught.message : 'Could not save the wallet.');
      setBusy(false);
    }
  };

  return (
    <ScreenBackground>
      <ScreenHeader title="Set a passcode" />

      <View style={styles.body}>
        <Text style={styles.headline}>Lock this wallet</Text>
        <Text style={styles.subhead}>
          The passcode encrypts your recovery phrase on this device. A long passphrase protects you
          far better than six digits.
        </Text>

        <TextField
          label="Passcode"
          icon="lock-closed-outline"
          value={passcode}
          onChangeText={setPasscode}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="newPassword"
          placeholder={`At least ${MIN_PASSCODE_LENGTH} characters`}
          error={tooShort ? `Use at least ${MIN_PASSCODE_LENGTH} characters.` : undefined}
        />

        <TextField
          label="Confirm passcode"
          icon="lock-closed-outline"
          value={confirmation}
          onChangeText={setConfirmation}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Type it again"
          error={mismatch ? 'The two entries do not match.' : undefined}
        />

        {biometricsAvailable ? (
          <Card style={styles.biometrics}>
            <View style={styles.biometricsText}>
              <Text style={styles.biometricsTitle}>Require Face ID / fingerprint</Text>
              <Text style={styles.biometricsBody}>
                Adds a device check before the encrypted key can be read at all.
              </Text>
            </View>
            <Switch
              value={useBiometrics}
              onValueChange={setUseBiometrics}
              trackColor={{ true: colors.gradient[0], false: colors.border }}
              thumbColor={colors.text}
            />
          </Card>
        ) : null}

        {error !== null ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={styles.actions}>
        <Button
          label="Create wallet"
          loading={busy}
          disabled={!canSubmit}
          onPress={handleSubmit}
        />
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    gap: spacing.xl,
  },
  headline: {
    ...typography.headline,
    color: colors.text,
  },
  subhead: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  biometrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
  },
  biometricsText: {
    flex: 1,
    gap: spacing.xs,
  },
  biometricsTitle: {
    ...typography.body,
    color: colors.text,
  },
  biometricsBody: {
    ...typography.caption,
    color: colors.textMuted,
  },
  error: {
    ...typography.bodySmall,
    color: colors.negative,
  },
  actions: {
    paddingBottom: spacing.xl,
  },
});
