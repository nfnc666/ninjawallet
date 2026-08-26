import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Button, Card, CoinIcon, ScreenBackground, ScreenHeader } from '@/components';
import { useWallet } from '@/wallet/WalletContext';
import { colors, radius, spacing, typography } from '@/theme';

/**
 * figma 249:845 ("swap") — from/to cards with the circular flip button between
 * them.
 *
 * NOT WIRED UP. A real swap means routing through a DEX aggregator, approving
 * a token allowance, and signing a contract call with slippage limits — that is
 * its own piece of work with its own failure modes. The layout is here so the
 * next step is only the integration; the button stays disabled until then
 * rather than pretending to quote a rate.
 */
export default function Swap() {
  const { network } = useWallet();

  return (
    <ScreenBackground>
      <ScreenHeader title="Swap" showBack={false} />

      <View style={styles.body}>
        <SwapCard direction="From" symbol={network.currencySymbol} />

        <View style={styles.flipRow}>
          <LinearGradient
            colors={colors.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.flip}
          >
            <Ionicons name="swap-vertical" size={20} color={colors.text} />
          </LinearGradient>
        </View>

        <SwapCard direction="To" symbol="USDC" />

        <Card style={styles.notice}>
          <Ionicons name="construct-outline" size={20} color={colors.warning} />
          <Text style={styles.noticeText}>
            Swapping is not implemented yet. It needs a DEX aggregator, a token approval step, and
            slippage protection — wiring the button to anything less would risk your funds.
          </Text>
        </Card>
      </View>

      <View style={styles.actions}>
        <Button label="Swap" disabled onPress={() => undefined} />
      </View>
    </ScreenBackground>
  );
}

function SwapCard({ direction, symbol }: { direction: string; symbol: string }) {
  return (
    <Card style={styles.swapCard}>
      <Text style={styles.direction}>{direction}</Text>
      <View style={styles.swapRow}>
        <Text style={styles.amount}>0.00</Text>
        <View style={styles.selector}>
          <CoinIcon symbol={symbol} size={28} />
          <Text style={styles.selectorLabel}>{symbol}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.text} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    gap: spacing.md,
  },
  swapCard: {
    gap: spacing.md,
    padding: spacing.xl,
  },
  direction: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  swapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  amount: {
    ...typography.headline,
    color: colors.text,
    opacity: 0.4,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfacePressed,
  },
  selectorLabel: {
    ...typography.bodySmall,
    color: colors.text,
  },
  flipRow: {
    alignItems: 'center',
    marginVertical: -spacing.xs,
  },
  flip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  noticeText: {
    ...typography.bodySmall,
    flex: 1,
    color: colors.textMuted,
  },
  actions: {
    paddingBottom: spacing.xl,
  },
});
