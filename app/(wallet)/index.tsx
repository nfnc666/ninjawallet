import React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

import { CoinIcon, CoinRow, ScreenBackground } from '@/components';
import { assetsForNetwork } from '@/wallet/assets';
import { formatAmount, formatCoin, shortenAddress } from '@/wallet/chain';
import { fiatValue, formatFiat, networkHasFiatValue, portfolioTotal } from '@/wallet/prices';
import { usePrices } from '@/wallet/usePrices';
import { useBalance } from '@/wallet/useBalance';
import { useBitcoin } from '@/wallet/useBitcoin';
import { useTokenBalances } from '@/wallet/useTokenBalances';
import { useWallet } from '@/wallet/WalletContext';
import { colors, radius, spacing, typography } from '@/theme';

/**
 * figma 249:680 ("get started v2") — balance card over the action row and the
 * asset list.
 *
 * The fiat total is shown only on mainnet. Testnet coins do not trade, so a
 * dollar figure for them would be invented; the card shows the coin amount and
 * says so instead.
 */
export default function Portfolio() {
  const { network, addresses, currency } = useWallet();
  const balance = useBalance(network, addresses?.evm ?? null);
  const bitcoin = useBitcoin(addresses?.bitcoin ?? null);
  const tokens = useTokenBalances(network, addresses?.evm ?? null);
  const assets = assetsForNetwork(network);

  const showFiat = networkHasFiatValue(network);
  // Every symbol, on every network: a testnet coin has no market and is
  // dropped by the price feed anyway, while the bitcoin address is derived on
  // mainnet regardless, so its value is real even here.
  const { prices, error: priceError } = usePrices(
    assets.map((asset) => asset.symbol),
    currency,
  );

  /** What this asset's row can actually show, or null when nothing was read. */
  const amountOf = (asset: (typeof assets)[number]): bigint | null => {
    if (asset.symbol === network.currencySymbol) return balance.value;
    if (asset.symbol === 'BTC') return bitcoin.balance?.confirmed ?? null;
    return tokens.balances[asset.symbol] ?? null;
  };

  const holdings = assets
    .map((asset) => ({
      symbol: asset.symbol,
      amount: amountOf(asset),
      decimals: asset.unit.decimals,
    }))
    .filter((holding): holding is { symbol: string; amount: bigint; decimals: number } =>
      holding.amount !== null,
    );

  // The card sums every holding that could be priced and names the rest, so a
  // total is never quietly short of an asset the wallet actually holds.
  const { total, unpriced } = portfolioTotal(holdings, prices);
  const nativeAmount = balance.value;
  const nativeFiat = showFiat && holdings.length > 0 ? total : null;
  const loading = balance.loading || bitcoin.loading || tokens.loading;
  const refreshAll = () => {
    balance.refresh();
    bitcoin.refresh();
    tokens.refresh();
  };

  return (
    <ScreenBackground glow>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refreshAll} tintColor={colors.text} />
        }
      >
        <View style={styles.topBar}>
          <View>
            <Text style={styles.greeting}>Main balance</Text>
            <Text style={styles.networkName}>{network.name}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            hitSlop={12}
            onPress={() => router.push('/(wallet)/settings')}
          >
            <Ionicons name="settings-outline" size={22} color={colors.text} />
          </Pressable>
        </View>

        <LinearGradient
          colors={colors.gradientHero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceCard}
        >
          <Text style={styles.balanceLabel}>
            {showFiat ? 'Total balance' : 'Test balance — not real money'}
          </Text>

          <Text style={styles.balanceValue} accessibilityRole="text">
            {nativeFiat !== null
              ? formatFiat(nativeFiat, currency)
              : nativeAmount !== null
                ? `${formatCoin(nativeAmount, network)} ${network.currencySymbol}`
                : balance.error !== null
                  ? '—'
                  : 'Loading…'}
          </Text>

          {nativeFiat !== null && nativeAmount !== null ? (
            <Text style={styles.balanceSub}>
              {formatCoin(nativeAmount, network)} {network.currencySymbol}
            </Text>
          ) : null}

          {showFiat && nativeFiat === null && nativeAmount !== null ? (
            <Text style={styles.balanceSub}>
              {priceError ?? 'Price unavailable'} — showing coin amount only
            </Text>
          ) : null}

          {/* A total that silently drops an asset is worse than one that says
              which asset it dropped. */}
          {nativeFiat !== null && unpriced.length > 0 ? (
            <Text style={styles.balanceSub}>
              Not counted: {unpriced.join(', ')} — no price available
            </Text>
          ) : null}

          {addresses !== null ? (
            <Text style={styles.address}>{shortenAddress(addresses.evm)}</Text>
          ) : null}

          {balance.error !== null ? <Text style={styles.balanceError}>{balance.error}</Text> : null}
        </LinearGradient>

        <View style={styles.actions}>
          <ActionButton
            icon="arrow-up"
            label="Send"
            onPress={() => router.push(`/send/${network.currencySymbol}`)}
          />
          <ActionButton
            icon="arrow-down"
            label="Receive"
            onPress={() => router.push(`/receive/${network.currencySymbol}`)}
          />
          <ActionButton
            icon="swap-horizontal"
            label="Swap"
            onPress={() => router.push('/(wallet)/swap')}
          />
        </View>

        <View style={styles.moreRow}>
          <ActionButton icon="card-outline" label="Buy" onPress={() => router.push('/buy')} />
          <ActionButton
            icon="cash-outline"
            label="Sell"
            onPress={() => router.push({ pathname: '/buy', params: { side: 'sell' } })}
          />
          <ActionButton icon="layers-outline" label="Stake" onPress={() => router.push('/stake')} />
          <ActionButton icon="images-outline" label="NFTs" onPress={() => router.push('/nfts')} />
          <ActionButton
            icon="trending-up-outline"
            label="Markets"
            onPress={() => router.push('/market')}
          />
        </View>

        <Text style={styles.sectionTitle}>Assets</Text>

        <View style={styles.assets}>
          {assets.map((asset) => {
            const held = amountOf(asset);
            const assetPrice = prices[asset.symbol];
            const rowFiat =
              held !== null && assetPrice !== undefined
                ? fiatValue(held, asset.unit.decimals, assetPrice)
                : null;

            return (
              <CoinRow
                key={asset.symbol}
                symbol={asset.symbol}
                name={asset.name}
                balance={
                  held === null ? undefined : `${formatAmount(held, asset.unit)} ${asset.symbol}`
                }
                value={rowFiat !== null ? formatFiat(rowFiat, currency) : undefined}
                // The note explains what the row cannot do; once a balance is
                // real, only the missing half is still worth saying.
                note={asset.support === 'full' && held !== null ? undefined : asset.note}
                onPress={() => router.push(`/coin/${asset.symbol}`)}
              />
            );
          })}
        </View>

        {!network.isMainnet ? (
          <Pressable
            style={styles.faucet}
            onPress={() => router.push('/(wallet)/settings')}
            accessibilityRole="button"
          >
            <CoinIcon symbol={network.currencySymbol} size={28} />
            <Text style={styles.faucetText}>
              You are on {network.name}. Coins here have no value — get some free from a faucet to
              try a transfer.
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </ScreenBackground>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
    >
      <Ionicons name={icon} size={20} color={colors.text} />
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greeting: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  networkName: {
    ...typography.body,
    color: colors.text,
  },
  balanceCard: {
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radius.sheet,
  },
  balanceLabel: {
    ...typography.bodySmall,
    color: colors.text,
    opacity: 0.9,
  },
  balanceValue: {
    ...typography.displayLarge,
    color: colors.text,
  },
  balanceSub: {
    ...typography.bodySmall,
    color: colors.text,
    opacity: 0.9,
  },
  address: {
    ...typography.bodySmall,
    color: colors.text,
    opacity: 0.85,
  },
  balanceError: {
    ...typography.caption,
    color: colors.text,
    opacity: 0.9,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  moreRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  action: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  actionPressed: {
    backgroundColor: colors.surfacePressed,
  },
  actionLabel: {
    ...typography.bodySmall,
    color: colors.text,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
  },
  assets: {
    gap: spacing.md,
  },
  faucet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  faucetText: {
    ...typography.caption,
    flex: 1,
    color: colors.textMuted,
  },
});
