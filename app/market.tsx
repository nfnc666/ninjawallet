import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button, Card, CoinIcon, ScreenBackground, ScreenHeader, TextField } from '@/components';
import { fetchMarkets, searchMarkets, topGainers, type MarketCoin } from '@/wallet/markets';
import { formatFiat } from '@/wallet/prices';
import { useWallet } from '@/wallet/WalletContext';
import { colors, radius, spacing, typography } from '@/theme';

/**
 * figma 249:1067 ("search action / top gainers") — search field over a ranked
 * list, with a "Show all" button under it.
 *
 * The figures are live. The design's mock rows all read +10.40%; real ones
 * move, and a coin the service did not report a change for shows a dash rather
 * than 0%, because unknown and flat are different things.
 */
export default function Market() {
  const { currency } = useWallet();
  const [coins, setCoins] = useState<MarketCoin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetchMarkets(currency)
      .then((result) => {
        if (cancelled) return;
        setCoins(result);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : 'Could not load market data.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currency, nonce]);

  const searching = query.trim() !== '';
  const visible = searching
    ? searchMarkets(coins, query)
    : showAll
      ? coins
      : topGainers(coins, 10);

  return (
    <ScreenBackground>
      <ScreenHeader title="Markets" />

      <TextField
        value={query}
        onChangeText={setQuery}
        placeholder="Search…"
        icon="search"
        autoCapitalize="none"
        autoCorrect={false}
        trailing={
          searching ? (
            <Pressable accessibilityRole="button" hitSlop={12} onPress={() => setQuery('')}>
              <Text style={styles.clear}>✕</Text>
            </Pressable>
          ) : undefined
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => {
              setLoading(true);
              setNonce((n) => n + 1);
            }}
            tintColor={colors.text}
          />
        }
      >
        <Text style={styles.sectionTitle}>
          {searching ? 'Results' : showAll ? 'All coins' : 'Top gainers · 24h'}
        </Text>

        {error !== null ? (
          <Card style={styles.notice}>
            <Text style={styles.noticeText}>{error}</Text>
            <Button
              label="Try again"
              variant="ghost"
              onPress={() => {
                setLoading(true);
                setNonce((n) => n + 1);
              }}
            />
          </Card>
        ) : loading && coins.length === 0 ? (
          <ActivityIndicator color={colors.text} style={styles.spinner} />
        ) : visible.length === 0 ? (
          <Card style={styles.notice}>
            <Text style={styles.noticeText}>
              {searching ? `Nothing matches “${query.trim()}”.` : 'No market data right now.'}
            </Text>
          </Card>
        ) : (
          visible.map((coin) => <MarketRow key={coin.id} coin={coin} currency={currency} />)
        )}

        {!searching && !showAll && coins.length > 10 && error === null ? (
          <Button label="Show all" onPress={() => setShowAll(true)} style={styles.showAll} />
        ) : null}
      </ScrollView>
    </ScreenBackground>
  );
}

function MarketRow({ coin, currency }: { coin: MarketCoin; currency: 'usd' | 'eur' | 'gbp' }) {
  const change = coin.changePercent24h;
  const positive = (change ?? 0) >= 0;

  return (
    <View style={styles.row}>
      <CoinIcon symbol={coin.symbol} size={36} />

      <View style={styles.rowText}>
        <View style={styles.rowLeft}>
          <Text style={styles.name} numberOfLines={1}>
            {coin.name}
          </Text>
          <Text style={styles.symbol}>{coin.symbol}</Text>
        </View>

        <View style={styles.rowRight}>
          <Text
            style={[
              styles.change,
              change === null
                ? styles.changeUnknown
                : positive
                  ? styles.changeUp
                  : styles.changeDown,
            ]}
          >
            {change === null
              ? '—'
              : `${positive ? '↑' : '↓'} ${Math.abs(change).toFixed(2)}%`}
          </Text>
          <Text style={styles.price}>{formatFiat(coin.price, currency)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.xxxl },
  sectionTitle: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  spinner: { marginTop: spacing.xxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  rowText: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowLeft: { gap: 2, flexShrink: 1 },
  rowRight: { gap: 2, alignItems: 'flex-end', flexShrink: 0 },
  name: { ...typography.body, color: colors.text },
  symbol: { ...typography.bodySmall, color: colors.textMuted },
  change: { ...typography.bodySmall },
  changeUp: { color: colors.positive },
  changeDown: { color: colors.negative },
  changeUnknown: { color: colors.textMuted },
  price: { ...typography.bodySmall, color: colors.text },
  clear: { ...typography.body, color: colors.textMuted },
  notice: { gap: spacing.md, padding: spacing.lg, alignItems: 'flex-start' },
  noticeText: { ...typography.bodySmall, color: colors.textMuted },
  showAll: { marginTop: spacing.lg },
});
