import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';

import { Button, Card, CoinIcon, ScreenBackground, ScreenHeader } from '@/components';
import { buildRampUrl, rampAvailability, type RampSide } from '@/wallet/onramp';
import { shortenAddress } from '@/wallet/chain';
import { useWallet } from '@/wallet/WalletContext';
import { colors, spacing, typography } from '@/theme';

/**
 * figma 249:2370 ("buy coins") and 249:2438 ("sell coins").
 *
 * Both sides hand off to a regulated ramp provider rather than pretending this
 * wallet can take a card payment: doing that for real means KYC, holding fiat,
 * and a money transmitter licence. The destination address is filled in for
 * you, because a mistyped address at this step cannot be undone.
 */
export default function BuyOrSell() {
  const { side } = useLocalSearchParams<{ side?: string }>();
  const mode: RampSide = side === 'sell' ? 'sell' : 'buy';
  const { network, addresses } = useWallet();

  const availability = rampAvailability(network);
  const verb = mode === 'buy' ? 'Buy' : 'Sell';

  const open = () => {
    if (addresses === null) return;
    Linking.openURL(buildRampUrl({ side: mode, network, address: addresses.evm }));
  };

  return (
    <ScreenBackground glow>
      <ScreenHeader title={`${verb} ${network.currencySymbol}`} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <View style={styles.hero}>
          <CoinIcon symbol={network.currencySymbol} size={72} />
          <Text style={styles.headline}>
            {verb} {network.currencySymbol}
          </Text>
        </View>

        {!availability.available ? (
          <Card style={styles.notice}>
            <Ionicons name="information-circle-outline" size={20} color={colors.warning} />
            <Text style={styles.noticeText}>{availability.reason}</Text>
          </Card>
        ) : (
          <>
            <Card style={styles.notice}>
              <Ionicons name="business-outline" size={20} color={colors.textMuted} />
              <Text style={styles.noticeText}>
                {mode === 'buy'
                  ? 'The purchase happens at a licensed provider, not in this app. They handle ' +
                    'payment and identity checks, then send the coins straight to your address.'
                  : 'The sale happens at a licensed provider. You send them coins from this ' +
                    'wallet and they pay out to your bank — this app never holds your funds.'}
              </Text>
            </Card>

            {addresses !== null ? (
              <Card style={styles.addressCard}>
                <Text style={styles.addressLabel}>
                  {mode === 'buy' ? 'Coins will arrive at' : 'Selling from'}
                </Text>
                <Text style={styles.address}>{shortenAddress(addresses.evm, 12, 10)}</Text>
                <Text style={styles.addressNote}>
                  Filled in for you — check it matches before you pay.
                </Text>
              </Card>
            ) : null}

            <Card style={styles.notice}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.positive} />
              <Text style={styles.noticeText}>
                Your recovery phrase never leaves this device and is never shared with the
                provider. No legitimate provider will ever ask for it.
              </Text>
            </Card>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={`Continue to provider`}
          disabled={!availability.available || addresses === null}
          onPress={open}
        />
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg, paddingBottom: spacing.xxl },
  hero: { alignItems: 'center', gap: spacing.md },
  headline: { ...typography.headline, color: colors.text },
  notice: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  noticeText: { ...typography.bodySmall, flex: 1, color: colors.textMuted },
  addressCard: { gap: spacing.xs, padding: spacing.lg },
  addressLabel: { ...typography.caption, color: colors.textMuted },
  address: { ...typography.body, color: colors.text },
  addressNote: { ...typography.caption, color: colors.warning },
  footer: { paddingVertical: spacing.xl },
});
