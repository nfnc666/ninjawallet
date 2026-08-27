import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CoinIcon } from './CoinIcon';
import { colors, radius, spacing, typography } from '@/theme';

interface CoinRowProps {
  symbol: string;
  name: string;
  /** Balance line under the name, already formatted, e.g. "0.6789 BTC". */
  balance?: string;
  /** Right-hand value line, e.g. "$699". */
  value?: string;
  /** Percentage change; positive renders teal with an up arrow. */
  changePercent?: number;
  /** Shown instead of the value when the asset is not fully supported yet. */
  note?: string;
  onPress?: () => void;
}

/**
 * figma (249:1415): 40pt icon, 10pt gap, name 16pt white over a 14pt
 * #8A8F9E balance, right column with change over value.
 */
export function CoinRow({
  symbol,
  name,
  balance,
  value,
  changePercent,
  note,
  onPress,
}: CoinRowProps) {
  const isPositive = (changePercent ?? 0) >= 0;

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${name}${balance ? `, ${balance}` : ''}`}
      disabled={onPress === undefined}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <CoinIcon symbol={symbol} />

      <View style={styles.text}>
        <View style={styles.left}>
          <Text style={styles.name}>{name}</Text>
          {balance ? <Text style={styles.balance}>{balance}</Text> : null}
        </View>

        <View style={styles.right}>
          {changePercent !== undefined ? (
            <Text style={[styles.change, { color: isPositive ? colors.positive : colors.negative }]}>
              {isPositive ? '↑' : '↓'} {Math.abs(changePercent).toFixed(2)}%
            </Text>
          ) : null}
          {value ? <Text style={styles.value}>{value}</Text> : null}
          {note ? <Text style={styles.note}>{note}</Text> : null}
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
  pressed: {
    backgroundColor: colors.surfacePressed,
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
  name: {
    ...typography.body,
    color: colors.text,
  },
  balance: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  change: {
    ...typography.bodySmall,
  },
  value: {
    ...typography.bodySmall,
    color: colors.text,
    textAlign: 'right',
  },
  note: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'right',
  },
});
