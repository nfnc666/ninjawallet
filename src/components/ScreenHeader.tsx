import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { colors, spacing, typography } from '@/theme';

interface ScreenHeaderProps {
  /** Rendered uppercase and centred, as on every detail screen in the design. */
  title?: string;
  onBack?: () => void;
  showBack?: boolean;
  right?: React.ReactNode;
}

/** figma: back chevron left, uppercase 14pt title centred, action slot right. */
export function ScreenHeader({ title, onBack, showBack = true, right }: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.side}>
        {showBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={12}
            onPress={onBack ?? (() => router.back())}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
        ) : null}
      </View>

      {title ? (
        <Text style={styles.title} numberOfLines={1}>
          {title.toUpperCase()}
        </Text>
      ) : (
        <View style={styles.flex} />
      )}

      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    marginBottom: spacing.xl,
  },
  side: {
    width: 44,
    justifyContent: 'center',
  },
  right: {
    alignItems: 'flex-end',
  },
  flex: {
    flex: 1,
  },
  title: {
    ...typography.bodySmall,
    flex: 1,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: 1,
  },
});
