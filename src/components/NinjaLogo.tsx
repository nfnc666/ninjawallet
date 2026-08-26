import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import { colors } from '@/theme';

/**
 * PLACEHOLDER MARK.
 *
 * The real Ninja Wallet logo lives in Figma as an exported SVG that this
 * environment cannot reach (the network policy blocks figma.com). This is a
 * stand-in built to the same silhouette — a masked ninja over a wallet, on a
 * black disc — and to the design's 128pt sizing. Replace `NinjaLogo` with the
 * exported asset before shipping anything user-facing.
 */
export function NinjaLogo({ size = 128 }: { size?: number }) {
  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 128 128" accessibilityLabel="Ninja Wallet">
        <Circle cx={64} cy={64} r={64} fill="#0B0B0B" />

        {/* Wallet body */}
        <Path
          d="M44 62h44a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6H44a6 6 0 0 1-6-6V68a6 6 0 0 1 6-6Z"
          fill="#FFFFFF"
        />
        <Path d="M74 76h22v10H74a5 5 0 0 1 0-10Z" fill="#E4E4E4" />
        <Circle cx={80} cy={81} r={2.5} fill="#0B0B0B" />

        {/* Masked head */}
        <Ellipse cx={62} cy={45} rx={22} ry={19} fill="#FFFFFF" />
        <Path d="M40 44h44v9a22 19 0 0 1-44 0Z" fill="#0B0B0B" />
        <Circle cx={54} cy={46} r={3} fill="#FFFFFF" />
        <Circle cx={70} cy={46} r={3} fill="#FFFFFF" />

        {/* Head scarf tail */}
        <Path d="M84 40 106 32l-18 14Z" fill={colors.gradient[1]} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
