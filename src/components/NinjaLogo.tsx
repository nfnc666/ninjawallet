import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

/**
 * The Ninja Wallet mark: a masked ninja peeking out of a wallet on a black
 * disc, with the headband scarf streaming left.
 *
 * REDRAWN, NOT THE EXPORT. The build environment's network policy blocks
 * figma.com, so the file's exported SVG could not be downloaded. This is traced
 * from the design's own render (node 249:2615) and matches its composition,
 * proportions and palette — but it is an approximation, not the original
 * vector. Drop the real export in here when it is available; nothing else
 * needs to change, the component's sizing contract stays the same.
 */
export function NinjaLogo({ size = 128 }: { size?: number }) {
  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg
        width={size}
        height={size}
        viewBox="0 0 128 128"
        accessibilityLabel="Ninja Wallet"
        accessibilityRole="image"
      >
        <Circle cx={64} cy={64} r={64} fill="#0B0B0B" />

        {/* Headband knot — short tapered strands rising off the head. */}
        <G fill="#FFFFFF">
          <Path d="M55.5 48.5c-1.6-4.6-3.6-8.3-6-11 .1 3.9.9 7.7 2.4 11.4z" />
          <Path d="M60.5 47.6c-.7-4.8-1.6-8.8-2.8-12-.6 4-.5 8 .3 12z" />
          <Path d="M65.5 47.9c.5-4.7 1.5-8.6 2.9-11.8-.1 3.9-.7 7.8-1.9 11.7z" />
        </G>

        {/* Head. */}
        <Path d="M52 47h24a3.5 3.5 0 0 1 3.5 3.5V66h-31V50.5A3.5 3.5 0 0 1 52 47z" fill="#FFFFFF" />
        <Rect x={48.5} y={52.5} width={31} height={6} fill="#0B0B0B" />
        <Rect x={53.5} y={54} width={5.5} height={3} rx={1.5} fill="#FFFFFF" />
        <Rect x={69} y={54} width={5.5} height={3} rx={1.5} fill="#FFFFFF" />

        {/* Scarf, drawn before the wallet so it reads as passing behind it. */}
        <Path
          d="M44 70c-6.4-1.7-12.9-1.4-19.4.9 2.6 1.3 5 2.1 7.3 2.5-3.1 1.7-6.5 2.6-10.3 2.7 5.1 3 10.6 3.7 16.4 2.1 3-.8 5-2 6-3.5z"
          fill="#FF4D0D"
        />

        {/* Wallet, over the head so the ninja peeks out of it. */}
        <Path
          d="M43 64h42a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6H43a6 6 0 0 1-6-6V70a6 6 0 0 1 6-6z"
          fill="#F4F4F4"
        />
        <Path d="M37 74h54v1.6H37z" fill="#E4E4E4" />
        {/* Card slot and clasp on the right edge. */}
        <Path d="M77 78h14v11H77a5.5 5.5 0 0 1 0-11z" fill="#E2E2E2" />
        <Circle cx={82.5} cy={83.5} r={2.6} fill="#0B0B0B" />

        {/* Sparkles. */}
        <Path d="M88 40l1 2.3 2.3 1-2.3 1-1 2.3-1-2.3-2.3-1 2.3-1z" fill="#FF4D0D" />
        <Path d="M79 33l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" fill="#FF4D0D" />
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
