import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Button, Card, ScreenBackground, ScreenHeader, TextField } from '@/components';
import { isValidMnemonic, normalizeMnemonic } from '@/wallet/mnemonic';
import { setDraftPhrase } from '@/wallet/onboardingDraft';
import { colors, spacing, typography } from '@/theme';

/**
 * figma 297:652 — "restore wallet (your secret phrase)". Accepts a 12 or
 * 24-word BIP-39 phrase and hands it to the passcode step.
 */
export default function RestoreWallet() {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const normalized = normalizeMnemonic(input);
  const wordCount = normalized === '' ? 0 : normalized.split(' ').length;
  const lengthLooksRight = wordCount === 12 || wordCount === 24;

  const handleContinue = () => {
    if (!isValidMnemonic(normalized)) {
      // A checksum failure is almost always one mistyped or misordered word.
      setError(
        lengthLooksRight
          ? 'That phrase fails its checksum. Check the spelling and the word order.'
          : 'A recovery phrase is 12 or 24 words.',
      );
      return;
    }
    setError(null);
    setDraftPhrase(normalized);
    router.push('/(onboarding)/passcode');
  };

  return (
    <ScreenBackground>
      <ScreenHeader title="Restore wallet" />

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.headline}>Enter your recovery phrase</Text>
        <Text style={styles.subhead}>
          Twelve or twenty-four words, separated by spaces, in their original order.
        </Text>

        <TextField
          value={input}
          onChangeText={(text) => {
            setInput(text);
            setError(null);
          }}
          placeholder="witch collapse practice feed shame open…"
          multiline
          numberOfLines={4}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
          textAlignVertical="top"
          style={styles.input}
          error={error ?? undefined}
        />

        <Text style={styles.counter}>
          {wordCount} {wordCount === 1 ? 'word' : 'words'}
        </Text>

        <Card style={styles.notice}>
          <Text style={styles.noticeText}>
            Typing a phrase you were sent by someone else hands them your funds. Only ever restore a
            phrase you generated yourself.
          </Text>
        </Card>
      </KeyboardAvoidingView>

      <View style={styles.actions}>
        <Button label="Continue" disabled={!lengthLooksRight} onPress={handleContinue} />
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    gap: spacing.lg,
  },
  headline: {
    ...typography.headline,
    color: colors.text,
  },
  subhead: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  input: {
    minHeight: 120,
  },
  counter: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'right',
  },
  notice: {
    padding: spacing.lg,
  },
  noticeText: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  actions: {
    paddingBottom: spacing.xl,
  },
});
