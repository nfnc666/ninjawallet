import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { ScreenBackground, ScreenHeader, TextField } from '@/components';
import { searchCurrencies, type CurrencyCode } from '@/wallet/currency';
import { useWallet } from '@/wallet/WalletContext';
import { colors, radius, spacing, typography } from '@/theme';

/**
 * figma 249:2506 ("select currency") — search field over a list of currencies.
 *
 * This is a display setting only. Balances are held in the coin itself, so
 * switching here re-prices what you see and touches nothing else.
 */
export default function SelectCurrency() {
  const { currency, setCurrency } = useWallet();
  const [query, setQuery] = useState('');
  const results = searchCurrencies(query);

  const choose = async (code: CurrencyCode) => {
    await setCurrency(code);
    router.back();
  };

  return (
    <ScreenBackground>
      <ScreenHeader title="Select currency" />

      <TextField
        value={query}
        onChangeText={setQuery}
        placeholder="Search…"
        icon="search"
        autoCapitalize="characters"
        autoCorrect={false}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        {results.length === 0 ? (
          <Text style={styles.empty}>No currency matches “{query.trim()}”.</Text>
        ) : (
          results.map((entry) => (
            <Pressable
              key={entry.code}
              accessibilityRole="radio"
              accessibilityState={{ selected: entry.code === currency }}
              onPress={() => choose(entry.code)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <Text style={styles.flag}>{entry.flag}</Text>
              <View style={styles.text}>
                <Text style={styles.label}>{entry.label}</Text>
                <Text style={styles.name}>{entry.name}</Text>
              </View>
              {entry.code === currency ? (
                <Ionicons name="checkmark-circle" size={22} color={colors.positive} />
              ) : (
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              )}
            </Pressable>
          ))
        )}

        <Text style={styles.note}>
          A display setting only — your coins are unchanged, and this never affects a key or a
          transaction.
        </Text>
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.xxxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  rowPressed: { backgroundColor: colors.surfacePressed },
  flag: { fontSize: 30 },
  text: { flex: 1, gap: 2 },
  label: { ...typography.body, color: colors.text },
  name: { ...typography.bodySmall, color: colors.textMuted },
  empty: { ...typography.bodySmall, color: colors.textMuted },
  note: { ...typography.caption, color: colors.textMuted, marginTop: spacing.lg },
});
