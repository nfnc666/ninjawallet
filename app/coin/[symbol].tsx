import React from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { Button, Card, CoinIcon, ScreenBackground, ScreenHeader } from '@/components';
import { assetsForNetwork } from '@/wallet/assets';
import { formatCoin } from '@/wallet/chain';
import { useBalance } from '@/wallet/useBalance';
import { useWallet } from '@/wallet/WalletContext';
import { colors, spacing, typography } from '@/theme';

/**
 * figma 140:1495 ("coin view") — hero mark, balance, send/receive, activity.
 *
 * The design's price chart and percentage change are not rendered: this build
 * has no price feed, and drawing a plausible-looking chart from nothing would
 * be inventing market data.
 */
export default function CoinDetail() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const { network, addresses } = useWallet();
  const balance = useBalance(network, addresses?.evm ?? null);

  const asset = assetsForNetwork(network).find((candidate) => candidate.symbol === symbol);
  const isNative = symbol === network.currencySymbol;
  const address = symbol === 'BTC' ? addresses?.bitcoin : addresses?.evm;

  return (
    <ScreenBackground glow>
      <ScreenHeader title={asset?.name ?? symbol} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.body}
        refreshControl={
          isNative ? (
            <RefreshControl
              refreshing={balance.loading}
              onRefresh={balance.refresh}
              tintColor={colors.text}
            />
          ) : undefined
        }
      >
        <View style={styles.hero}>
          <CoinIcon symbol={symbol} size={88} />
          <Text style={styles.balance}>
            {isNative && balance.value !== null
              ? `${formatCoin(balance.value, network)} ${symbol}`
              : `— ${symbol}`}
          </Text>
          <Text style={styles.network}>{isNative ? network.name : 'Bitcoin mainnet'}</Text>
        </View>

        <View style={styles.actions}>
          <Button
            label="Send"
            style={styles.action}
            disabled={!isNative}
            onPress={() => router.push(`/send/${symbol}`)}
          />
          <Button
            label="Receive"
            variant="ghost"
            style={styles.action}
            onPress={() => router.push(`/receive/${symbol}`)}
          />
        </View>

        {!isNative ? (
          <Card style={styles.notice}>
            <Ionicons name="information-circle-outline" size={20} color={colors.textMuted} />
            <Text style={styles.noticeText}>
              {symbol} is receive-only here. The address is derived from your phrase, but this build
              does not read the {symbol} chain or build {symbol} transactions.
            </Text>
          </Card>
        ) : null}

        <Text style={styles.sectionTitle}>Activity</Text>
        <Card style={styles.activity}>
          <Text style={styles.activityText}>
            Transaction history is not indexed in this build. Your full history is public on the
            chain — open the explorer to read it.
          </Text>
          {address !== undefined && address !== null && isNative ? (
            <Button
              label="Open in explorer"
              variant="ghost"
              onPress={() => Linking.openURL(network.explorerAddressUrl(address))}
            />
          ) : null}
        </Card>
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.md,
  },
  balance: {
    ...typography.displayLarge,
    color: colors.text,
    textAlign: 'center',
  },
  network: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  action: {
    flex: 1,
  },
  notice: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  noticeText: {
    ...typography.bodySmall,
    flex: 1,
    color: colors.textMuted,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
  },
  activity: {
    gap: spacing.lg,
    padding: spacing.lg,
  },
  activityText: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
});
