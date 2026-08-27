import React, { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { Button, Card, ScreenBackground, ScreenHeader, TextField } from '@/components';
import { shortenAddress } from '@/wallet/chain';
import { unlockWallet, WrongPasscodeError } from '@/wallet/keystore';
import { NETWORKS, type NetworkId } from '@/wallet/networks';
import { useWallet } from '@/wallet/WalletContext';
import { colors, radius, spacing, typography } from '@/theme';

/** figma 249:3595 ("setting") — grouped rows on the dark surface. */
export default function Settings() {
  const { network, setNetwork, addresses, lock, forgetWallet } = useWallet();
  const [revealPasscode, setRevealPasscode] = useState('');
  const [revealedPhrase, setRevealedPhrase] = useState<string | null>(null);
  const [revealError, setRevealError] = useState<string | null>(null);
  const [revealOpen, setRevealOpen] = useState(false);

  const handleNetwork = (id: NetworkId) => {
    if (NETWORKS[id].isMainnet) {
      Alert.alert(
        'Switch to Ethereum mainnet?',
        'Mainnet moves real money. This wallet has not been security-audited — do not put in more than you are willing to lose.',
        [
          { text: 'Stay on testnet', style: 'cancel' },
          { text: 'Switch anyway', style: 'destructive', onPress: () => setNetwork(id) },
        ],
      );
      return;
    }
    setNetwork(id);
  };

  const handleReveal = async () => {
    setRevealError(null);
    try {
      const { phrase } = await unlockWallet(revealPasscode);
      setRevealedPhrase(phrase);
      setRevealPasscode('');
    } catch (caught) {
      setRevealError(
        caught instanceof WrongPasscodeError ? 'Wrong passcode.' : 'Could not read the wallet.',
      );
    }
  };

  const handleErase = () => {
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
    <ScreenBackground>
      <ScreenHeader title="Settings" showBack={false} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <Section title="Network">
          {Object.values(NETWORKS).map((candidate) => (
            <Pressable
              key={candidate.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: candidate.id === network.id }}
              onPress={() => handleNetwork(candidate.id)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{candidate.name}</Text>
                <Text style={styles.rowSubtitle}>
                  {candidate.isMainnet ? 'Real funds' : 'Test funds, no value'}
                </Text>
              </View>
              {candidate.id === network.id ? (
                <Ionicons name="checkmark-circle" size={22} color={colors.positive} />
              ) : null}
            </Pressable>
          ))}

          {network.faucetUrl !== undefined ? (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => Linking.openURL(network.faucetUrl as string)}
              accessibilityRole="link"
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Get test coins</Text>
                <Text style={styles.rowSubtitle}>Opens a {network.name} faucet</Text>
              </View>
              <Ionicons name="open-outline" size={20} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </Section>

        <Section title="Addresses">
          <AddressRow label="Ethereum" value={addresses?.evm ?? null} />
          <AddressRow label="Bitcoin" value={addresses?.bitcoin ?? null} />
        </Section>

        <Section title="Security">
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => {
              setRevealOpen((open) => !open);
              setRevealedPhrase(null);
              setRevealError(null);
            }}
            accessibilityRole="button"
          >
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Show recovery phrase</Text>
              <Text style={styles.rowSubtitle}>Requires your passcode</Text>
            </View>
            <Ionicons
              name={revealOpen ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>

          {revealOpen ? (
            <Card style={styles.reveal}>
              {revealedPhrase === null ? (
                <>
                  <TextField
                    value={revealPasscode}
                    onChangeText={setRevealPasscode}
                    secureTextEntry
                    autoCapitalize="none"
                    placeholder="Passcode"
                    icon="lock-closed-outline"
                    error={revealError ?? undefined}
                  />
                  <Button
                    label="Reveal"
                    variant="ghost"
                    disabled={revealPasscode.length === 0}
                    onPress={handleReveal}
                  />
                </>
              ) : (
                <>
                  <Text style={styles.phrase} selectable>
                    {revealedPhrase}
                  </Text>
                  <Text style={styles.phraseWarning}>
                    Anyone who sees this owns your funds. Close this screen when you are done.
                  </Text>
                  <Button label="Hide" variant="ghost" onPress={() => setRevealedPhrase(null)} />
                </>
              )}
            </Card>
          ) : null}

          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => {
              lock();
              router.replace('/(onboarding)/unlock');
            }}
            accessibilityRole="button"
          >
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Lock now</Text>
              <Text style={styles.rowSubtitle}>Clears the key from memory</Text>
            </View>
            <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} />
          </Pressable>
        </Section>

        <Section title="Support">
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => router.push('/support')}
            accessibilityRole="button"
          >
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Help</Text>
              <Text style={styles.rowSubtitle}>What can and cannot be recovered</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>
        </Section>

        <Button label="Erase wallet from this device" variant="ghost" onPress={handleErase} />

        <Text style={styles.disclaimer}>
          Ninja Wallet is unaudited software. Keys are generated and stored only on this device;
          there is no backup service and no way to recover a lost recovery phrase.
        </Text>
      </ScrollView>
    </ScreenBackground>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function AddressRow({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{label}</Text>
        <Text style={styles.rowSubtitle}>{value === null ? 'Locked' : shortenAddress(value, 10, 8)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing.xxl,
    paddingBottom: spacing.xxxl,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionBody: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  rowPressed: {
    backgroundColor: colors.surfacePressed,
  },
  rowText: {
    flex: 1,
    gap: spacing.xs,
  },
  rowTitle: {
    ...typography.body,
    color: colors.text,
  },
  rowSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
  },
  reveal: {
    gap: spacing.lg,
    padding: spacing.lg,
  },
  phrase: {
    ...typography.body,
    color: colors.text,
    lineHeight: 26,
  },
  phraseWarning: {
    ...typography.caption,
    color: colors.warning,
  },
  disclaimer: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
