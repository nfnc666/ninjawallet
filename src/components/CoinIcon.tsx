import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, layout } from '@/theme';

/**
 * Coin marks.
 *
 * The Figma file's icons are exported assets we cannot fetch from this
 * environment, so Bitcoin and Ethereum are redrawn here from their published
 * brand geometry and everything else falls back to a branded monogram. Swap in
 * the real exports when the design assets are available — the sizing contract
 * (40pt outer circle, 22pt glyph) matches the design's `icon` node.
 */

export interface CoinBrand {
  background: string;
  foreground: string;
}

const BRANDS: Record<string, CoinBrand> = {
  BTC: { background: '#F7931A', foreground: '#FFFFFF' },
  ETH: { background: '#627EEA', foreground: '#FFFFFF' },
  SepoliaETH: { background: '#627EEA', foreground: '#FFFFFF' },
  USDT: { background: '#26A17B', foreground: '#FFFFFF' },
  USDC: { background: '#2775CA', foreground: '#FFFFFF' },
  BNB: { background: '#F3BA2F', foreground: '#FFFFFF' },
  SOL: { background: '#14F195', foreground: '#0B0B0B' },
  ADA: { background: '#0033AD', foreground: '#FFFFFF' },
};

const FALLBACK: CoinBrand = { background: '#3A2B4A', foreground: '#FFFFFF' };

interface CoinIconProps {
  symbol: string;
  /** figma: 40pt on list rows, 64–96pt on hero headers. */
  size?: number;
}

export function CoinIcon({ symbol, size = layout.iconSize }: CoinIconProps) {
  const brand = BRANDS[symbol] ?? FALLBACK;
  const glyphSize = size * 0.55;

  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: brand.background },
      ]}
      accessibilityRole="image"
      accessibilityLabel={`${symbol} icon`}
    >
      <CoinGlyph symbol={symbol} size={glyphSize} color={brand.foreground} />
    </View>
  );
}

function CoinGlyph({ symbol, size, color }: { symbol: string; size: number; color: string }) {
  if (symbol === 'BTC') {
    // The Bitcoin ₿ is a typographic mark; rendering the character keeps the
    // stroke weights right at every size.
    return <Text style={[styles.glyph, { fontSize: size, color }]}>₿</Text>;
  }

  if (symbol === 'ETH' || symbol === 'SepoliaETH') {
    // Ethereum's diamond: two stacked faces, upper one split down the middle.
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M12 1.5 5.5 12.3 12 16.1 18.5 12.3Z" fill={color} opacity={0.75} />
        <Path d="M12 1.5 12 16.1 18.5 12.3Z" fill={color} />
        <Path d="M12 17.4 5.5 13.6 12 22.5 18.5 13.6Z" fill={color} opacity={0.75} />
        <Path d="M12 17.4 12 22.5 18.5 13.6Z" fill={color} />
      </Svg>
    );
  }

  return (
    <Text style={[styles.glyph, { fontSize: size * 0.8, color }]}>{symbol.slice(0, 1)}</Text>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  glyph: {
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
    color: colors.text,
  },
});
