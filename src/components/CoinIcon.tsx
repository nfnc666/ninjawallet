import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors, layout } from '@/theme';

/**
 * Coin marks.
 *
 * The Figma file's icon exports are unreachable from this environment, so each
 * mark is constructed from its published brand geometry instead: Bitcoin and
 * Tether are typographic (₿, ₮), Ethereum, Binance and Solana are polygons,
 * Cardano is its dot lattice, USDC its dollar glyph. Anything without a mark
 * falls back to a branded monogram, which is a placeholder, not a design.
 *
 * Sizing follows the design's `icon` node: a 40pt circle with the glyph at 55%.
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
  SOL: { background: '#0B0B0B', foreground: '#14F195' },
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

/** A diamond (square on its corner) centred at cx,cy with half-diagonal d. */
function diamond(cx: number, cy: number, d: number): string {
  return `M${cx} ${cy - d}L${cx + d} ${cy}L${cx} ${cy + d}L${cx - d} ${cy}Z`;
}

/**
 * Cardano's mark is a lattice of dots: one centre, a ring of six, and an outer
 * ring of twelve, each ring smaller than the last. Generating it beats
 * transcribing thirty-odd circle coordinates by hand.
 */
const CARDANO_DOTS: { cx: number; cy: number; r: number }[] = [
  { cx: 12, cy: 12, r: 1.9 },
  ...Array.from({ length: 6 }, (_, i) => {
    const angle = (i * 60 * Math.PI) / 180;
    return {
      cx: 12 + Math.cos(angle) * 5.1,
      cy: 12 + Math.sin(angle) * 5.1,
      r: 1.55,
    };
  }),
  ...Array.from({ length: 12 }, (_, i) => {
    const angle = ((i * 30 + 15) * Math.PI) / 180;
    return {
      cx: 12 + Math.cos(angle) * 9.4,
      cy: 12 + Math.sin(angle) * 9.4,
      r: 1.15,
    };
  }),
];

function CoinGlyph({ symbol, size, color }: { symbol: string; size: number; color: string }) {
  // Bitcoin and Tether are typographic marks; rendering the character keeps
  // the stroke weights right at every size.
  if (symbol === 'BTC') {
    return <Text style={[styles.glyph, { fontSize: size, color }]}>₿</Text>;
  }
  if (symbol === 'USDT') {
    return <Text style={[styles.glyph, { fontSize: size, color }]}>₮</Text>;
  }
  if (symbol === 'USDC') {
    return <Text style={[styles.glyph, { fontSize: size * 0.95, color }]}>$</Text>;
  }

  if (symbol === 'ETH' || symbol === 'SepoliaETH') {
    // Ethereum's diamond: two stacked faces, the upper one split down the middle.
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M12 1.5 5.5 12.3 12 16.1 18.5 12.3Z" fill={color} opacity={0.75} />
        <Path d="M12 1.5 12 16.1 18.5 12.3Z" fill={color} />
        <Path d="M12 17.4 5.5 13.6 12 22.5 18.5 13.6Z" fill={color} opacity={0.75} />
        <Path d="M12 17.4 12 22.5 18.5 13.6Z" fill={color} />
      </Svg>
    );
  }

  if (symbol === 'BNB') {
    // Binance: a centre diamond with four satellites on the cardinal points.
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={diamond(12, 12, 3.6)} fill={color} />
        <Path d={diamond(12, 5.4, 3.1)} fill={color} />
        <Path d={diamond(12, 18.6, 3.1)} fill={color} />
        <Path d={diamond(5.4, 12, 3.1)} fill={color} />
        <Path d={diamond(18.6, 12, 3.1)} fill={color} />
      </Svg>
    );
  }

  if (symbol === 'SOL') {
    // Solana: three bars, the middle one skewed against the outer two.
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M7 5.6H20.5L17 8.9H3.5Z" fill={color} />
        <Path d="M3.5 10.35H17L20.5 13.65H7Z" fill={color} />
        <Path d="M7 15.1H20.5L17 18.4H3.5Z" fill={color} />
      </Svg>
    );
  }

  if (symbol === 'ADA') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {CARDANO_DOTS.map((dot, index) => (
          <Circle
            key={index}
            cx={Number(dot.cx.toFixed(2))}
            cy={Number(dot.cy.toFixed(2))}
            r={dot.r}
            fill={color}
          />
        ))}
      </Svg>
    );
  }

  return <Text style={[styles.glyph, { fontSize: size * 0.8, color }]}>{symbol.slice(0, 1)}</Text>;
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
