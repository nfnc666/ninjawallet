import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { toPolyline, type PriceSeries } from '@/wallet/chartData';
import { formatFiat } from '@/wallet/prices';
import type { CurrencyCode } from '@/wallet/currency';
import { colors, spacing, typography } from '@/theme';

/** figma: the line is a thin 2pt mark; the chart carries no other stroke. */
const STROKE = 2;

interface PriceChartProps {
  series: PriceSeries;
  currency: CurrencyCode;
  height?: number;
}

/**
 * figma 140:1495 — the price line under the balance card.
 *
 * One series, so no legend: the surrounding screen names the coin. The line is
 * 2px and the only chrome is a hairline at the high and the low, because the
 * shape is the whole message. High and low are the only direct labels — a
 * number on every point would bury it.
 *
 * Colour carries direction (up teal, down red), which is a state, not an
 * identity, so it does not collide with any categorical palette. Every piece of
 * text stays in the theme's ink tokens rather than taking the line's colour.
 *
 * Touch scrubs: dragging reads out the price at that moment rather than leaving
 * the reader to estimate it off an axis.
 */
export function PriceChart({ series, currency, height = 180 }: PriceChartProps) {
  const [width, setWidth] = useState(0);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);

  const rising = series.changePercent >= 0;
  const lineColor = rising ? colors.positive : colors.negative;

  // Inset by half the stroke width, otherwise the 2px line is clipped in half
  // at the left and right edges and at the exact high and low.
  const inset = STROKE / 2;
  const plotWidth = Math.max(width - STROKE, 0);
  const plotHeight = Math.max(height - STROKE, 0);

  const geometry = useMemo(
    () =>
      toPolyline(series.points, plotWidth, plotHeight, series.low, series.high).map((point) => ({
        x: point.x + inset,
        y: point.y + inset,
      })),
    [series.points, series.low, series.high, plotWidth, plotHeight, inset],
  );

  const linePath = useMemo(() => {
    if (geometry.length < 2) return null;
    return geometry
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(' ');
  }, [geometry]);

  // Closing the path to the baseline gives the fill; the line itself stays open.
  const areaPath = useMemo(() => {
    if (linePath === null || geometry.length < 2) return null;
    const last = geometry[geometry.length - 1] as { x: number; y: number };
    const first = geometry[0] as { x: number; y: number };
    return `${linePath} L${last.x.toFixed(2)} ${height} L${first.x.toFixed(2)} ${height} Z`;
  }, [linePath, geometry, height]);

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  const scrubTo = (x: number) => {
    if (geometry.length === 0 || width <= 0) return;
    const ratio = Math.min(Math.max(x / width, 0), 1);
    setScrubIndex(Math.round(ratio * (geometry.length - 1)));
  };

  const scrubbed =
    scrubIndex !== null ? (series.points[scrubIndex] ?? null) : null;
  const scrubPoint = scrubIndex !== null ? (geometry[scrubIndex] ?? null) : null;

  if (series.points.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>No price history for this range.</Text>
      </View>
    );
  }

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={
        `Price chart. Low ${formatFiat(series.low, currency)}, ` +
        `high ${formatFiat(series.high, currency)}, ` +
        `change ${series.changePercent.toFixed(2)} percent.`
      }
    >
      <View style={styles.readout}>
        <Text style={styles.readoutValue}>
          {scrubbed !== null
            ? formatFiat(scrubbed.price, currency)
            : formatFiat(series.high, currency)}
        </Text>
        <Text style={styles.readoutLabel}>
          {scrubbed !== null
            ? new Date(scrubbed.timestamp).toLocaleString()
            : 'High in this range'}
        </Text>
      </View>

      <View
        style={{ height }}
        onLayout={onLayout}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(event) => scrubTo(event.nativeEvent.locationX)}
        onResponderMove={(event) => scrubTo(event.nativeEvent.locationX)}
        onResponderRelease={() => setScrubIndex(null)}
        onResponderTerminate={() => setScrubIndex(null)}
      >
        {width > 0 && linePath !== null ? (
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={lineColor} stopOpacity={0.28} />
                <Stop offset="1" stopColor={lineColor} stopOpacity={0} />
              </LinearGradient>
            </Defs>

            {/* Hairline rules at the high and the low — the only grid there is. */}
            <Line x1={0} y1={0.5} x2={width} y2={0.5} stroke={colors.border} strokeWidth={1} />
            <Line
              x1={0}
              y1={height - 0.5}
              x2={width}
              y2={height - 0.5}
              stroke={colors.border}
              strokeWidth={1}
            />

            {areaPath !== null ? <Path d={areaPath} fill="url(#priceFill)" /> : null}

            <Path
              d={linePath}
              stroke={lineColor}
              strokeWidth={STROKE}
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {scrubPoint !== null ? (
              <>
                <Line
                  x1={scrubPoint.x}
                  y1={0}
                  x2={scrubPoint.x}
                  y2={height}
                  stroke={colors.borderStrong}
                  strokeWidth={1}
                />
                {/* Surface ring keeps the dot legible where it sits on the line. */}
                <Circle cx={scrubPoint.x} cy={scrubPoint.y} r={6} fill={colors.background} />
                <Circle cx={scrubPoint.x} cy={scrubPoint.y} r={4} fill={lineColor} />
              </>
            ) : null}
          </Svg>
        ) : null}
      </View>

      <View style={styles.bounds}>
        <Text style={styles.boundLabel}>Low {formatFiat(series.low, currency)}</Text>
        <Text style={styles.boundLabel}>High {formatFiat(series.high, currency)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { gap: 2, marginBottom: spacing.md },
  readoutValue: { ...typography.title, color: colors.text },
  readoutLabel: { ...typography.caption, color: colors.textMuted },
  bounds: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  // Text keeps its ink token rather than taking the line's colour.
  boundLabel: { ...typography.caption, color: colors.textMuted },
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...typography.bodySmall, color: colors.textMuted },
});
