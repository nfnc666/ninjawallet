import React, { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import {
  Button,
  Card,
  CoinIcon,
  HistoryRow,
  PriceChart,
  ScreenBackground,
  ScreenHeader,
} from '@/components';
import { assetsForNetwork } from '@/wallet/assets';
import { formatCoin } from '@/wallet/chain';
import { fiatValue, formatFiat, networkHasFiatValue } from '@/wallet/prices';
import { usePrices } from '@/wallet/usePrices';
import { usePriceSeries } from '@/wallet/usePriceSeries';
import { CHART_RANGES, DEFAULT_RANGE, type ChartRangeId } from '@/wallet/chartData';
import { useBalance } from '@/wallet/useBalance';
import { useHistory } from '@/wallet/useHistory';
import { useWallet } from '@/wallet/WalletContext';
import { colors, radius, spacing, typography } from '@/theme';

/**
 * figma 140:1495 ("coin view") — hero mark, balance, send/receive, activity.
 *
 * The spot price is real. The design's price *chart* is still not drawn — that
 * needs historical series, and sketching a plausible-looking curve from a
 * single spot price would be inventing market data.
 */
export default function CoinDetail() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const { network, addresses, currency } = useWallet();
  const balance = useBalance(network, addresses?.evm ?? null);

  const asset = assetsForNetwork(network).find((candidate) => candidate.symbol === symbol);
  const isNative = symbol === network.currencySymbol;
  const address = symbol === 'BTC' ? addresses?.bitcoin : addresses?.evm;

  const history = useHistory(network, isNative ? (addresses?.evm ?? null) : null);

  const [range, setRange] = useState<ChartRangeId>(DEFAULT_RANGE);

  const showFiat = networkHasFiatValue(network);
  const { prices } = usePrices(showFiat ? [symbol] : [], currency);
  const chart = usePriceSeries(showFiat ? symbol : null, range, currency);
  const price = prices[symbol];
  const holdingFiat =
    isNative && balance.value !== null && price !== undefined
      ? fiatValue(balance.value, network.currencyDecimals, price)
      : null;

  return (
    <ScreenBackground glow>
      <ScreenHeader title={asset?.name ?? symbol} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.body}
        refreshControl={
          isNative ? (
            <RefreshControl
              refreshing={balance.loading || history.loading}
              onRefresh={() => {
                balance.refresh();
                history.refresh();
              }}
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
          {holdingFiat !== null ? (
            <Text style={styles.fiat}>{formatFiat(holdingFiat, currency)}</Text>
          ) : null}

          <Text style={styles.network}>{isNative ? network.name : 'Bitcoin mainnet'}</Text>

          {price !== undefined ? (
            <Text style={styles.spot}>1 {symbol} = {formatFiat(price, currency)}</Text>
          ) : null}
        </View>

        {showFiat ? (
          <View style={styles.chartBlock}>
            {chart.error !== null ? (
              <Card style={styles.notice}>
                <Text style={styles.noticeText}>{chart.error}</Text>
                <Button label="Try again" variant="ghost" onPress={chart.refresh} />
              </Card>
            ) : chart.series !== null ? (
              <PriceChart series={chart.series} currency={currency} />
            ) : (
              <View style={styles.chartLoading}>
                <ActivityIndicator color={colors.text} />
              </View>
            )}

            <View style={styles.ranges}>
              {CHART_RANGES.map((entry) => (
                <Pressable
                  key={entry.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: entry.id === range }}
                  onPress={() => setRange(entry.id)}
                  style={[styles.rangePill, entry.id === range && styles.rangePillActive]}
                >
                  <Text
                    style={[styles.rangeText, entry.id === range && styles.rangeTextActive]}
                  >
                    {entry.id}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

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

        {!isNative ? (
          <Card style={styles.activity}>
            <Text style={styles.activityText}>
              This build does not read the {symbol} chain, so there is no activity to show. Your
              history is public — open a {symbol} explorer to read it.
            </Text>
          </Card>
        ) : history.error !== null ? (
          <Card style={styles.activity}>
            <Text style={styles.activityText}>{history.error}</Text>
            <Button label="Try again" variant="ghost" onPress={history.refresh} />
          </Card>
        ) : history.loading && history.entries.length === 0 ? (
          <Card style={styles.activity}>
            <ActivityIndicator color={colors.text} />
          </Card>
        ) : history.entries.length === 0 ? (
          <Card style={styles.activity}>
            <Text style={styles.activityText}>
              No transactions yet. Anything you send or receive will show up here.
            </Text>
          </Card>
        ) : (
          <View style={styles.historyList}>
            {history.entries.map((entry) => (
              <HistoryRow
                key={entry.hash}
                entry={entry}
                network={network}
                onPress={() => Linking.openURL(network.explorerTxUrl(entry.hash))}
              />
            ))}
          </View>
        )}

        {address !== undefined && address !== null && isNative ? (
          <Button
            label="Open in explorer"
            variant="ghost"
            onPress={() => Linking.openURL(network.explorerAddressUrl(address))}
          />
        ) : null}
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
  fiat: {
    ...typography.title,
    color: colors.text,
  },
  spot: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  chartBlock: { gap: spacing.md },
  chartLoading: { height: 180, alignItems: 'center', justifyContent: 'center' },
  ranges: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  rangePill: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  rangePillActive: { backgroundColor: colors.text },
  rangeText: { ...typography.caption, color: colors.textMuted },
  rangeTextActive: { color: colors.textInverse },
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
  historyList: {
    gap: spacing.md,
  },
  activityText: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
});
