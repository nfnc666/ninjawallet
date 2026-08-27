import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card, ScreenBackground, ScreenHeader } from '@/components';
import { colors, radius, spacing, typography } from '@/theme';

/**
 * figma 249:3228 ("support") and 249:3382 ("help").
 *
 * The design shows a live support chat. There is no support desk behind this
 * build, so offering a chat box would be a dead end at exactly the moment
 * someone is panicking about funds. This answers the questions a support desk
 * would field instead, and is blunt about what cannot be recovered.
 */
const FAQ = [
  {
    q: 'I lost my recovery phrase. Can you restore my wallet?',
    a: 'No. Nobody can. The phrase is the only copy of your keys — it is not stored on any server, so there is nothing to reset. This is the trade-off of self-custody: no one can lock you out, and no one can let you back in.',
  },
  {
    q: 'I sent coins to the wrong address.',
    a: 'Confirmed transactions cannot be reversed by anyone, including us. If the address belongs to an exchange, contact their support quickly — they sometimes recover mistaken deposits. Otherwise the funds are with whoever controls that address.',
  },
  {
    q: 'Someone asked for my recovery phrase to help me.',
    a: 'It is a theft attempt, without exception. No support agent, airdrop, wallet or exchange ever needs your phrase. Anyone who has it can empty your wallet immediately and permanently.',
  },
  {
    q: 'My balance shows a dash or an old figure.',
    a: 'That means the node could not be reached, not that funds are missing. Your balance lives on the chain, not in this app. Pull to refresh, and check the same address in a block explorer to confirm.',
  },
  {
    q: 'Why does the app default to a testnet?',
    a: 'Because this wallet has not been security-audited. Sepolia coins are free and worthless, so mistakes cost nothing while you try it out. Mainnet is one switch away in Settings, behind a warning.',
  },
  {
    q: 'Can I use my phrase in another wallet?',
    a: 'Yes. It is a standard BIP-39 phrase and the addresses follow the registered paths (BIP-44 for Ethereum, BIP-84 for Bitcoin), so any compliant wallet will derive the same addresses.',
  },
] as const;

const LINKS = [
  { icon: 'book-outline', label: 'How self-custody works', url: 'https://ethereum.org/en/wallets/' },
  {
    icon: 'shield-outline',
    label: 'Spotting crypto scams',
    url: 'https://ethereum.org/en/security/',
  },
  {
    icon: 'logo-github',
    label: 'Report a bug',
    url: 'https://github.com/nfnc666/ninjawallet/issues',
  },
] as const;

export default function Support() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <ScreenBackground>
      <ScreenHeader title="Help" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <Card style={styles.notice}>
          <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.warning} />
          <Text style={styles.noticeText}>
            There is no live support chat, and there never will be one that asks for your keys.
            Anyone contacting you claiming to be Ninja Wallet support is an impostor.
          </Text>
        </Card>

        <Text style={styles.sectionTitle}>Common questions</Text>

        {FAQ.map((entry, index) => {
          const expanded = open === index;
          return (
            <Pressable
              key={entry.q}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              onPress={() => setOpen(expanded ? null : index)}
              style={({ pressed }) => [styles.faq, pressed && styles.faqPressed]}
            >
              <View style={styles.faqHead}>
                <Text style={styles.question}>{entry.q}</Text>
                <Ionicons
                  name={expanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.textMuted}
                />
              </View>
              {expanded ? <Text style={styles.answer}>{entry.a}</Text> : null}
            </Pressable>
          );
        })}

        <Text style={styles.sectionTitle}>Read more</Text>

        {LINKS.map((link) => (
          <Pressable
            key={link.url}
            accessibilityRole="link"
            onPress={() => Linking.openURL(link.url)}
            style={({ pressed }) => [styles.link, pressed && styles.faqPressed]}
          >
            <Ionicons name={link.icon} size={20} color={colors.textMuted} />
            <Text style={styles.linkLabel}>{link.label}</Text>
            <Ionicons name="open-outline" size={18} color={colors.textMuted} />
          </Pressable>
        ))}
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md, paddingBottom: spacing.xxxl },
  notice: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  noticeText: { ...typography.bodySmall, flex: 1, color: colors.textMuted },
  sectionTitle: { ...typography.title, color: colors.text, marginTop: spacing.lg },
  faq: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.card, backgroundColor: colors.surface },
  faqPressed: { backgroundColor: colors.surfacePressed },
  faqHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  question: { ...typography.body, color: colors.text, flex: 1 },
  answer: { ...typography.bodySmall, color: colors.textMuted },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  linkLabel: { ...typography.body, color: colors.text, flex: 1 },
});
