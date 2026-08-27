import React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, CoinIcon, NinjaLogo } from '@/components';
import { clearDraftPhrase } from '@/wallet/onboardingDraft';
import { colors, layout, spacing, typography } from '@/theme';

const { width } = Dimensions.get('window');

/**
 * figma 249:391 — full-bleed violet→orange gradient, concentric rings with coin
 * marks orbiting the logo, headline and two stacked pill buttons.
 */
export default function Welcome() {
  const handleCreate = () => {
    clearDraftPhrase();
    router.push('/(onboarding)/create');
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={colors.gradientHero}
        locations={[0, 0.55, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.hero}>
          <Orbit />
          <View style={styles.logo}>
            <NinjaLogo size={128} />
          </View>
        </View>

        <View style={styles.copy}>
          <Text style={styles.headline}>Easy and{'\n'}Secured to use</Text>
          <Text style={styles.subhead}>Your keys never leave this device</Text>
        </View>

        <View style={styles.actions}>
          <Button label="Create a new wallet" variant="light" onPress={handleCreate} />
          <Button
            label="Already have a wallet?"
            variant="glass"
            onPress={() => router.push('/(onboarding)/restore')}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

/** Ring radii, outermost first. */
const RING_RADII = [width * 0.475, width * 0.36, width * 0.24];

/**
 * Coin marks sit *on* a ring, placed by angle rather than by eyeballed offsets,
 * so none of them can drift under the logo disc at a different screen width.
 * Angles are measured clockwise from twelve o'clock.
 */
const ORBIT_COINS = [
  // Kept off ring 0 near the horizontal axis: that radius runs to the screen
  // edge, and a mark there gets clipped on a 430pt-wide phone.
  { symbol: 'BTC', size: 48, ring: 1, angle: 292 },
  { symbol: 'ETH', size: 44, ring: 2, angle: 70 },
  { symbol: 'BNB', size: 40, ring: 1, angle: 160 },
  { symbol: 'USDC', size: 36, ring: 0, angle: 35 },
  { symbol: 'ADA', size: 36, ring: 0, angle: 215 },
] as const;

/** The three concentric rings with coin marks sitting on them. */
function Orbit() {
  return (
    <View style={styles.orbit} pointerEvents="none">
      {RING_RADII.map((radius) => (
        <View
          key={radius}
          style={[
            styles.ring,
            { width: radius * 2, height: radius * 2, borderRadius: radius },
          ]}
        />
      ))}

      {ORBIT_COINS.map((coin) => {
        const radius = RING_RADII[coin.ring] ?? RING_RADII[0] ?? 0;
        const radians = ((coin.angle - 90) * Math.PI) / 180;
        return (
          <View
            key={coin.symbol}
            style={[
              styles.coin,
              {
                transform: [
                  { translateX: Math.cos(radians) * radius },
                  { translateY: Math.sin(radians) * radius },
                ],
              },
            ]}
          >
            <CoinIcon symbol={coin.symbol} size={coin.size} />
          </View>
        );
      })}
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
    paddingHorizontal: layout.screenPadding,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbit: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  coin: {
    // Centred on the container, then pushed out to its ring by transform.
    position: 'absolute',
  },
  logo: {
    // Sits above the rings so the disc masks them, as in the design.
    zIndex: 1,
  },
  copy: {
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  headline: {
    ...typography.displayLarge,
    color: colors.text,
    textAlign: 'center',
  },
  subhead: {
    ...typography.body,
    color: colors.text,
    opacity: 0.85,
    textAlign: 'center',
  },
  actions: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
});
