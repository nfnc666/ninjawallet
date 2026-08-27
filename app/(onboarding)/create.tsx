import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { Button, Card, ScreenBackground, ScreenHeader } from '@/components';
import { generateMnemonic } from '@/wallet/mnemonic';
import { assertSecureRandomAvailable } from '@/wallet/polyfills';
import { setDraftPhrase } from '@/wallet/onboardingDraft';
import { colors, spacing, typography } from '@/theme';

const POINTS = [
  {
    icon: 'key-outline',
    title: 'Your phrase is your wallet',
    body: 'Twelve words that regenerate every key. Anyone who reads them owns your funds.',
  },
  {
    icon: 'cloud-offline-outline',
    title: 'It never leaves this device',
    body: 'Ninja Wallet has no account and no server. Nothing is uploaded, so nothing can be handed over.',
  },
  {
    icon: 'warning-outline',
    title: 'Nobody can reset it',
    body: 'Lose the phrase and the funds are gone. There is no support line that can recover them.',
  },
] as const;

/** Generates the recovery phrase, after making the stakes explicit. */
export default function CreateWallet() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setBusy(true);
    setError(null);
    try {
      // Refuse to continue if the runtime's RNG looks broken — a predictable
      // phrase is worse than no wallet.
      assertSecureRandomAvailable();
      const phrase = await generateMnemonic(12);
      setDraftPhrase(phrase);
      router.replace('/(onboarding)/backup');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create a wallet.');
      setBusy(false);
    }
  };

  return (
    <ScreenBackground glow>
      <ScreenHeader title="Create wallet" />

      <View style={styles.body}>
        <Text style={styles.headline}>Before you start</Text>

        <View style={styles.points}>
          {POINTS.map((point) => (
            <Card key={point.title} style={styles.point}>
              <Ionicons name={point.icon} size={22} color={colors.gradient[1]} />
              <View style={styles.pointText}>
                <Text style={styles.pointTitle}>{point.title}</Text>
                <Text style={styles.pointBody}>{point.body}</Text>
              </View>
            </Card>
          ))}
        </View>
      </View>

      {error !== null ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <Button label="Generate recovery phrase" loading={busy} onPress={handleGenerate} />
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    gap: spacing.xxl,
  },
  headline: {
    ...typography.headline,
    color: colors.text,
  },
  points: {
    gap: spacing.lg,
  },
  point: {
    flexDirection: 'row',
    gap: spacing.lg,
    padding: spacing.lg,
  },
  pointText: {
    flex: 1,
    gap: spacing.xs,
  },
  pointTitle: {
    ...typography.body,
    color: colors.text,
  },
  pointBody: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  error: {
    ...typography.bodySmall,
    color: colors.negative,
    marginBottom: spacing.lg,
  },
  actions: {
    paddingBottom: spacing.xl,
  },
});
