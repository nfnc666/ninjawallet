import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, layout } from '@/theme';

interface ScreenBackgroundProps extends ViewProps {
  /**
   * Adds the violet-to-orange glow behind the top of the screen, as on the
   * welcome and coin-detail screens in the design. Off for list screens.
   */
  glow?: boolean;
  /** Set false when the screen manages its own horizontal padding. */
  padded?: boolean;
  children: React.ReactNode;
}

/**
 * The base every screen sits on: the deep aubergine page colour, the optional
 * hero glow, and the safe-area inset.
 */
export function ScreenBackground({
  glow = false,
  padded = true,
  style,
  children,
  ...rest
}: ScreenBackgroundProps) {
  return (
    <View style={styles.root} {...rest}>
      {glow ? (
        <LinearGradient
          colors={['rgba(176,47,203,0.35)', 'rgba(240,122,36,0.10)', 'rgba(25,14,35,0)']}
          locations={[0, 0.35, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.6 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      <SafeAreaView style={[styles.safe, padded && styles.padded, style]} edges={['top', 'bottom']}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safe: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: layout.screenPadding,
  },
});
