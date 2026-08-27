import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { formatWhen, type HistoryEntry } from '@/wallet/history';
import { formatCoin, shortenAddress } from '@/wallet/chain';
import type { NetworkConfig } from '@/wallet/networks';
import { colors, radius, spacing, typography } from '@/theme';

interface HistoryRowProps {
  entry: HistoryEntry;
  network: NetworkConfig;
  onPress?: () => void;
}

/** One transaction: direction, counterparty, amount and when it happened. */
export function HistoryRow({ entry, network, onPress }: HistoryRowProps) {
  const outgoing = entry.direction === 'out';
  const label =
    entry.direction === 'self' ? 'To yourself' : outgoing ? 'Sent' : 'Received';

  // A reverted transaction still cost a fee, so it is shown rather than hidden,
  // but its amount never moved — saying otherwise would misreport the balance.
  const amountPrefix = entry.succeeded ? (outgoing ? '−' : '+') : '';

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${label} ${formatCoin(entry.value, network)} ${network.currencySymbol}`}
      disabled={onPress === undefined}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={[styles.icon, !entry.succeeded && styles.iconFailed]}>
        <Ionicons
          name={
            !entry.succeeded
              ? 'close'
              : entry.direction === 'self'
                ? 'repeat'
                : outgoing
                  ? 'arrow-up'
                  : 'arrow-down'
          }
          size={18}
          color={entry.succeeded ? colors.text : colors.negative}
        />
      </View>

      <View style={styles.text}>
        <View style={styles.left}>
          <Text style={styles.title}>{entry.succeeded ? label : 'Failed'}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {entry.counterparty !== null ? shortenAddress(entry.counterparty) : 'Contract'}
          </Text>
        </View>

        <View style={styles.right}>
          <Text
            style={[
              styles.amount,
              entry.succeeded && !outgoing && styles.amountIn,
              !entry.succeeded && styles.amountFailed,
            ]}
          >
            {amountPrefix}
            {formatCoin(entry.value, network)} {network.currencySymbol}
          </Text>
          <Text style={styles.when}>{formatWhen(entry.timestamp)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  rowPressed: {
    backgroundColor: colors.surfacePressed,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfacePressed,
  },
  iconFailed: {
    backgroundColor: 'rgba(255,69,58,0.15)',
  },
  text: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  left: {
    gap: 2,
    flexShrink: 1,
  },
  right: {
    gap: 2,
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  title: {
    ...typography.body,
    color: colors.text,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  amount: {
    ...typography.bodySmall,
    color: colors.text,
    textAlign: 'right',
  },
  amountIn: {
    color: colors.positive,
  },
  amountFailed: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  when: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
