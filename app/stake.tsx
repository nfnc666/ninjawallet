import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button, Card, CoinIcon, ScreenBackground, ScreenHeader } from '@/components';
import { useWallet } from '@/wallet/WalletContext';
import { colors, spacing, typography } from '@/theme';

/**
 * figma 249:1263 ("staking").
 *
 * Deliberately informational. Staking in-app would mean sending funds into a
 * third-party contract from a wallet that has not been audited, and the design
 * shows headline yields that no honest build can quote without a live source.
 * So this explains the trade-offs and hands off, rather than printing an APR
 * someone might act on.
 */
const OPTIONS = [
  {
    icon: 'server-outline',
    title: 'Run your own validator',
    body: 'Requires 32 ETH and a machine that stays online. No third party holds your stake, and no one takes a cut.',
    caveat: 'Downtime is penalised, and exiting takes days.',
    url: 'https://ethereum.org/en/staking/solo/',
  },
  {
    icon: 'water-outline',
    title: 'Liquid staking',
    body: 'Deposit any amount and receive a token representing your stake, which stays tradeable while it earns.',
    caveat: 'You take on the protocol’s smart-contract risk, and the token can trade below the coin it represents.',
    url: 'https://ethereum.org/en/staking/pools/',
  },
  {
    icon: 'business-outline',
    title: 'Staking through an exchange',
    body: 'Simplest to start. The exchange runs the validator for you.',
    caveat: 'They hold the coins. If they fail, your stake goes with them.',
    url: 'https://ethereum.org/en/staking/',
  },
] as const;

export default function Stake() {
  const { network } = useWallet();

  return (
    <ScreenBackground glow>
      <ScreenHeader title="Staking" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <View style={styles.hero}>
          <CoinIcon symbol={network.currencySymbol} size={64} />
          <Text style={styles.headline}>Earn on your ETH</Text>
          <Text style={styles.subhead}>
            Staking locks coins to help secure the network, and pays a reward for doing it.
          </Text>
        </View>

        <Card style={styles.notice}>
          <Ionicons name="warning-outline" size={20} color={colors.warning} />
          <Text style={styles.noticeText}>
            Ninja Wallet does not stake for you. Every route below sends funds into someone
            else&apos;s contract or custody, and this build is unaudited — it is not the software
            that should be moving your stake. Read the trade-offs, then use a client you trust.
          </Text>
        </Card>

        {OPTIONS.map((option) => (
          <Card key={option.title} style={styles.option}>
            <View style={styles.optionHead}>
              <Ionicons name={option.icon} size={22} color={colors.gradient[1]} />
              <Text style={styles.optionTitle}>{option.title}</Text>
            </View>
            <Text style={styles.optionBody}>{option.body}</Text>
            <Text style={styles.optionCaveat}>{option.caveat}</Text>
            <Button label="Read more" variant="ghost" onPress={() => Linking.openURL(option.url)} />
          </Card>
        ))}

        <Text style={styles.disclaimer}>
          No yield figures are shown here on purpose. Rates move constantly, and a number printed
          from nothing is the kind of thing people act on.
        </Text>
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg, paddingBottom: spacing.xxxl },
  hero: { alignItems: 'center', gap: spacing.md },
  headline: { ...typography.headline, color: colors.text },
  subhead: { ...typography.bodySmall, color: colors.textMuted, textAlign: 'center' },
  notice: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  noticeText: { ...typography.bodySmall, flex: 1, color: colors.textMuted },
  option: { gap: spacing.sm, padding: spacing.lg },
  optionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  optionTitle: { ...typography.body, color: colors.text },
  optionBody: { ...typography.bodySmall, color: colors.textMuted },
  optionCaveat: { ...typography.caption, color: colors.warning },
  disclaimer: { ...typography.caption, color: colors.textMuted },
});
