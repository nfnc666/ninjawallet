import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { Button, Card, ScreenBackground, ScreenHeader } from '@/components';
import { getDraftPhrase } from '@/wallet/onboardingDraft';
import { colors, radius, spacing, typography } from '@/theme';

/**
 * Shows the twelve words for the user to write down.
 *
 * Words stay hidden behind a blur-style cover until the user asks to see them,
 * so the phrase is not sitting on screen in a coffee shop or a screen share.
 */
export default function BackupPhrase() {
  const phrase = getDraftPhrase();
  const words = useMemo(() => phrase?.split(' ') ?? [], [phrase]);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    // Deep-linked straight here, or the draft was cleared — start over rather
    // than showing an empty grid.
    if (phrase === null) router.replace('/(onboarding)/welcome');
  }, [phrase]);

  if (phrase === null) return null;

  const handleCopy = async () => {
    Alert.alert(
      'Copy to clipboard?',
      'Other apps can read the clipboard. Writing the words on paper is safer.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Copy anyway',
          style: 'destructive',
          onPress: () => Clipboard.setStringAsync(phrase),
        },
      ],
    );
  };

  return (
    <ScreenBackground>
      <ScreenHeader title="Recovery phrase" />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.headline}>Write these 12 words down</Text>
        <Text style={styles.subhead}>
          In order, on paper. This screen is the only time the phrase is shown.
        </Text>

        <View style={styles.grid}>
          {words.map((word, index) => (
            <View key={`${index}-${word}`} style={styles.wordChip}>
              <Text style={styles.wordIndex}>{index + 1}</Text>
              <Text style={styles.word}>{revealed ? word : '••••••'}</Text>
            </View>
          ))}
        </View>

        {!revealed ? (
          <Button label="Tap to reveal" variant="ghost" onPress={() => setRevealed(true)} />
        ) : (
          <Button
            label="Copy to clipboard"
            variant="ghost"
            leading={<Ionicons name="copy-outline" size={18} color={colors.text} />}
            onPress={handleCopy}
          />
        )}

        <Card style={styles.warning}>
          <Ionicons name="alert-circle-outline" size={20} color={colors.warning} />
          <Text style={styles.warningText}>
            Never type these words into a website, a support chat, or another app. Ninja Wallet will
            never ask for them.
          </Text>
        </Card>
      </ScrollView>

      <View style={styles.actions}>
        <Button
          label="I've written it down"
          disabled={!revealed}
          onPress={() => router.push('/(onboarding)/verify')}
        />
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  headline: {
    ...typography.headline,
    color: colors.text,
  },
  subhead: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  wordChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: '47%',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  wordIndex: {
    ...typography.caption,
    color: colors.textMuted,
    width: 18,
  },
  word: {
    ...typography.body,
    color: colors.text,
  },
  warning: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  warningText: {
    ...typography.bodySmall,
    flex: 1,
    color: colors.textMuted,
  },
  actions: {
    paddingVertical: spacing.xl,
  },
});
