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
import { formatAmount, unitOf } from '@/wallet/chain';
import { bitcoinExplorer } from '@/wallet/bitcoin';
import { fiatValue, formatFiat, networkHasFiatValue } from '@/wallet/prices';
import { usePrices } from '@/wallet/usePrices';
import { usePriceSeries } from '@/wallet/usePriceSeries';
import { useBitcoin } from '@/wallet/useBitcoin';
import { useTokenBalances } from '@/wallet/useTokenBalances';
import { CHART_RANGES, DEFAULT_RANGE, type ChartRangeId } from '@/wallet/chartData';
import { useBalance } from '@/wallet/useBalance';
import { useHistory } from '@/wallet/useHistory';
import { useWallet } from '@/wallet/WalletContext';
import { colors, radius, spacing, typography } from '@/theme';

/**
 * figma 140:1495 ("coin view") — hero mark, balance, chart, send/receive,
 * activity.
 *
 * Ether and bitcoin run through the same screen. They differ in where the
 * balance is read and in what the wallet can do with it: bitcoin is read from a
 * public explorer and cannot be spent from here, which the screen says outright
 * rather than leaving a dead Send button to explain itself.
 */
export default function CoinDetail() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const { network, addresses, currency } = useWallet();

  const asset = assetsForNetwork(network).find((candidate) => candidate.symbol === symbol);
  const isNative = symbol === network.currencySymbol;
  const isBitcoin = symbol === 'BTC';
  const token = asset?.token;
  const address = isBitcoin ? addresses?.bitcoin : addresses?.evm;

  const evm = addresses?.evm ?? null;
  const balance = useBalance(network, isNative ? evm : null);
  const tokens = useTokenBalances(network, token !== undefined ? evm : null);
  const history = useHistory(network, isNative || token !== undefined ? evm : null, token);
  const bitcoin = useBitcoin(isBitcoin ? (addresses?.bitcoin ?? null) : null, true);

  const [range, setRange] = useState<ChartRangeId>(DEFAULT_RANGE);

  // The bitcoin address is derived on mainnet whatever EVM network is selected,
  // so its balance is real money and carries a real fiat value even while the
  // Ethereum side is on a testnet.
  const showFiat = isBitcoin || networkHasFiatValue(network);
  const unit = asset?.unit ?? unitOf(network);

  const { prices } = usePrices(showFiat ? [symbol] : [], currency);
  const chart = usePriceSeries(showFiat ? symbol : null, range, currency);
  const price = prices[symbol];

  const held = isBitcoin
    ? (bitcoin.balance?.confirmed ?? null)
    : token !== undefined
      ? (tokens.balances[symbol] ?? null)
      : balance.value;
  const holdingFiat =
    held !== null && price !== undefined ? fiatValue(held, unit.decimals, price) : null;

  // Bitcoin is read from its own explorer; everything else on the EVM side
  // shares the balance and history hooks.
  const loading = isBitcoin
    ? bitcoin.loading
    : balance.loading || tokens.loading || history.loading;
  const balanceError = isBitcoin ? bitcoin.error : (tokens.error ?? balance.error);
  const entries = isBitcoin ? bitcoin.entries : history.entries;
  const historyError = isBitcoin ? bitcoin.error : history.error;
  const refresh = () => {
    if (isBitcoin) {
      bitcoin.refresh();
      return;
    }
    balance.refresh();
    tokens.refresh();
    history.refresh();
  };
  const canSend = isNative || token !== undefined;
  const readsChain = canSend || isBitcoin;
  const pending = bitcoin.balance?.pending ?? 0n;

  return (
    <ScreenBackground glow>
      <ScreenHeader title={asset?.name ?? symbol} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.body}
        refreshControl={
          readsChain ? (
            <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.text} />
          ) : undefined
        }
      >
        <View style={styles.hero}>
          <CoinIcon symbol={symbol} size={88} />
          <Text style={styles.balance}>
            {held !== null ? `${formatAmount(held, unit)} ${symbol}` : `— ${symbol}`}
          </Text>
          {holdingFiat !== null ? (
            <Text style={styles.fiat}>{formatFiat(holdingFiat, currency)}</Text>
          ) : null}

          {/* Unconfirmed coins are called out, never folded into the balance:
              a transaction in the mempool can still be replaced or dropped. */}
          {isBitcoin && pending !== 0n ? (
            <Text style={styles.pending}>
              {pending > 0n ? '+' : '−'}
              {formatAmount(pending < 0n ? -pending : pending, unit)} {symbol} unconfirmed
            </Text>
          ) : null}

          <Text style={styles.network}>{isBitcoin ? 'Bitcoin mainnet' : network.name}</Text>

          {price !== undefined ? (
            <Text style={styles.spot}>1 {symbol} = {formatFiat(price, currency)}</Text>
          ) : null}

          {balanceError !== null ? <Text style={styles.error}>{balanceError}</Text> : null}
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
            disabled={!canSend}
            onPress={() => router.push(`/send/${symbol}`)}
          />
          <Button
            label="Receive"
            variant="ghost"
            style={styles.action}
            onPress={() => router.push(`/receive/${symbol}`)}
          />
        </View>

        {!canSend ? (
          <Card style={styles.notice}>
            <Ionicons name="information-circle-outline" size={20} color={colors.textMuted} />
            <Text style={styles.noticeText}>
              {isBitcoin
                ? 'This balance and history are read live from the bitcoin chain, for the one ' +
                  'address shown under Receive. Sending needs coin selection and witness ' +
                  'signing, which this build does not do, so Send is off.'
                : `${symbol} is receive-only here. The address is derived from your phrase, but ` +
                  `this build does not read the ${symbol} chain or build ${symbol} transactions.`}
            </Text>
          </Card>
        ) : token !== undefined ? (
          <Card style={styles.notice}>
            <Ionicons name="information-circle-outline" size={20} color={colors.textMuted} />
            <Text style={styles.noticeText}>
              {symbol} is an ERC-20 on {network.name}. Sending it still costs gas in{' '}
              {network.currencySymbol}, which is deducted from your {network.currencySymbol}{' '}
              balance, not from your {symbol}.
            </Text>
          </Card>
        ) : null}

        <Text style={styles.sectionTitle}>Activity</Text>

        {!readsChain ? (
          <Card style={styles.activity}>
            <Text style={styles.activityText}>
              This build does not read the {symbol} chain, so there is no activity to show. Your
              history is public — open a {symbol} explorer to read it.
            </Text>
          </Card>
        ) : historyError !== null ? (
          <Card style={styles.activity}>
            <Text style={styles.activityText}>{historyError}</Text>
            <Button label="Try again" variant="ghost" onPress={refresh} />
          </Card>
        ) : loading && entries.length === 0 ? (
          <Card style={styles.activity}>
            <ActivityIndicator color={colors.text} />
          </Card>
        ) : entries.length === 0 ? (
          <Card style={styles.activity}>
            <Text style={styles.activityText}>
              No transactions yet. Anything you send or receive will show up here.
            </Text>
          </Card>
        ) : (
          <View style={styles.historyList}>
            {entries.map((entry) => (
              <HistoryRow
                key={entry.hash}
                entry={entry}
                unit={unit}
                onPress={() =>
                  Linking.openURL(
                    isBitcoin ? bitcoinExplorer.tx(entry.hash) : network.explorerTxUrl(entry.hash),
                  )
                }
              />
            ))}
          </View>
        )}

        {address !== undefined && address !== null && readsChain ? (
          <Button
            label="Open in explorer"
            variant="ghost"
            onPress={() =>
              Linking.openURL(
                isBitcoin ? bitcoinExplorer.address(address) : network.explorerAddressUrl(address),
              )
            }
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
  pending: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  error: {
    ...typography.bodySmall,
    color: colors.negative,
    textAlign: 'center',
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
