import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card, ScreenBackground, ScreenHeader } from '@/components';
import { colors, spacing, typography } from '@/theme';

/**
 * figma 249:2589 ("terms and conditions").
 *
 * Written as what it actually is: a statement of what this software does and
 * does not do. The points that matter are the ones about irreversibility and
 * the absence of any recovery path — burying those in boilerplate would defeat
 * the purpose of showing them at all.
 */
const SECTIONS = [
  {
    title: 'You hold the keys',
    body: 'Ninja Wallet generates your keys on this device and encrypts them here. There is no account, no server holding a copy, and no password reset. If you lose your recovery phrase, nobody can restore your funds — not the developers, not anyone.',
  },
  {
    title: 'Transactions are final',
    body: 'A confirmed blockchain transaction cannot be reversed, cancelled or refunded by anyone. Sending to a wrong address, on the wrong network, or in the wrong amount is permanent. Check every transfer before you confirm it.',
  },
  {
    title: 'This software is unaudited',
    body: 'It has not been reviewed by an independent security firm. It ships pointed at a test network on purpose. Using it with real funds is your decision and your risk, and you should not put in more than you are willing to lose.',
  },
  {
    title: 'No warranty',
    body: 'The software is provided as is, without warranty of any kind. The authors are not liable for lost funds, failed transactions, or damages arising from its use — including from bugs in this software.',
  },
  {
    title: 'Third-party services',
    body: 'Prices, transaction history, NFT data, swaps and fiat purchases are provided by third parties, each with their own terms and privacy practices. Querying them reveals your addresses to them. Swaps and purchases are transactions with those services, not with us.',
  },
  {
    title: 'Your responsibilities',
    body: 'Keep your recovery phrase offline and private. Never enter it into a website, an app, or a message to anyone claiming to be support. Verify addresses before sending. Keep your device and its operating system up to date.',
  },
  {
    title: 'Legal and tax',
    body: 'Crypto rules differ by country and change often. Whether you may use this software, and what you owe on what you do with it, is yours to determine. Nothing here is financial, legal or tax advice.',
  },
] as const;

export default function Terms() {
  return (
    <ScreenBackground>
      <ScreenHeader title="Terms" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <Card style={styles.notice}>
          <Ionicons name="warning-outline" size={20} color={colors.warning} />
          <Text style={styles.noticeText}>
            The short version: you are your own bank. That means no one can freeze your funds, and
            no one can get them back for you either.
          </Text>
        </Card>

        {SECTIONS.map((section, index) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>
              {index + 1}. {section.title}
            </Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}

        <Text style={styles.footer}>
          Ninja Wallet is open source. What it does is exactly what the code in this repository
          does — you are free to read it before trusting it.
        </Text>
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xl, paddingBottom: spacing.xxxl },
  notice: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  noticeText: { ...typography.bodySmall, flex: 1, color: colors.textMuted },
  section: { gap: spacing.sm },
  sectionTitle: { ...typography.body, color: colors.text },
  sectionBody: { ...typography.bodySmall, color: colors.textMuted },
  footer: { ...typography.caption, color: colors.textMuted },
});
