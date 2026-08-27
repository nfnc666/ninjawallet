import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Button, ScreenBackground, ScreenHeader } from '@/components';
import { pickVerificationIndices } from '@/wallet/mnemonic';
import { getDraftPhrase } from '@/wallet/onboardingDraft';
import { colors, radius, spacing, typography } from '@/theme';

/**
 * Quizzes the user on three random words so a phrase nobody wrote down cannot
 * reach the wallet screen.
 */
export default function VerifyPhrase() {
  const phrase = getDraftPhrase();
  const words = useMemo(() => phrase?.split(' ') ?? [], [phrase]);

  const [indices, setIndices] = useState<number[]>([]);
  const [step, setStep] = useState(0);
  const [wrongPick, setWrongPick] = useState<string | null>(null);

  useEffect(() => {
    if (phrase === null) {
      router.replace('/(onboarding)/welcome');
      return;
    }
    let cancelled = false;
    pickVerificationIndices(words.length, 3).then((picked) => {
      if (!cancelled) setIndices(picked);
    });
    return () => {
      cancelled = true;
    };
  }, [phrase, words.length]);

  const targetIndex = indices[step];
  const options = useMemo(
    () => (targetIndex === undefined ? [] : buildOptions(words, targetIndex)),
    [words, targetIndex],
  );

  if (phrase === null || targetIndex === undefined) return null;

  const handlePick = (word: string) => {
    if (word !== words[targetIndex]) {
      setWrongPick(word);
      return;
    }
    setWrongPick(null);
    if (step + 1 >= indices.length) {
      router.push('/(onboarding)/passcode');
    } else {
      setStep(step + 1);
    }
  };

  return (
    <ScreenBackground>
      <ScreenHeader title={`Check ${step + 1} of ${indices.length}`} />

      <View style={styles.body}>
        <Text style={styles.headline}>Which word is number {targetIndex + 1}?</Text>
        <Text style={styles.subhead}>Pick it from your written copy.</Text>

        <View style={styles.options}>
          {options.map((word) => {
            const isWrong = wrongPick === word;
            return (
              <Pressable
                key={word}
                accessibilityRole="button"
                onPress={() => handlePick(word)}
                style={({ pressed }) => [
                  styles.option,
                  pressed && styles.optionPressed,
                  isWrong && styles.optionWrong,
                ]}
              >
                <Text style={styles.optionText}>{word}</Text>
              </Pressable>
            );
          })}
        </View>

        {wrongPick !== null ? (
          <Text style={styles.error}>That is not word {targetIndex + 1}. Check your paper copy.</Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Button
          label="Show the phrase again"
          variant="ghost"
          onPress={() => router.replace('/(onboarding)/backup')}
        />
      </View>
    </ScreenBackground>
  );
}

/**
 * The correct word plus three decoys taken from elsewhere in the same phrase,
 * shuffled. Decoys come from the phrase itself so the choice cannot be made by
 * recognising an out-of-place word.
 */
function buildOptions(words: string[], targetIndex: number): string[] {
  const correct = words[targetIndex];
  if (correct === undefined) return [];

  const decoys = words.filter((word, index) => index !== targetIndex && word !== correct);
  const picked = new Set<string>();
  while (picked.size < Math.min(3, decoys.length)) {
    const candidate = decoys[Math.floor(Math.random() * decoys.length)];
    if (candidate !== undefined) picked.add(candidate);
  }

  return [correct, ...picked].sort(() => Math.random() - 0.5);
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
  options: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  option: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionPressed: {
    backgroundColor: colors.surfacePressed,
  },
  optionWrong: {
    borderColor: colors.negative,
  },
  optionText: {
    ...typography.body,
    color: colors.text,
    textAlign: 'center',
  },
  error: {
    ...typography.bodySmall,
    color: colors.negative,
    textAlign: 'center',
  },
  actions: {
    paddingBottom: spacing.xl,
  },
});
