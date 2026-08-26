import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, layout, radius, typography } from '@/theme';

export type ButtonVariant = 'primary' | 'light' | 'glass' | 'ghost';

interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  /**
   * `primary` is the violet-to-orange gradient CTA, `light` the white pill from
   * the welcome screen, `glass` its translucent sibling, `ghost` a plain row.
   */
  variant?: ButtonVariant;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Rendered to the left of the label — an icon, usually. */
  leading?: React.ReactNode;
}

/** figma: 62pt tall, fully rounded (radius 100), centred 16pt Inter Medium. */
export function Button({
  label,
  variant = 'primary',
  loading = false,
  disabled,
  style,
  leading,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled === true || loading;
  const labelColor = variant === 'light' ? colors.textInverse : colors.text;

  const content = (
    <View style={styles.content}>
      {loading ? (
        <ActivityIndicator color={labelColor} />
      ) : (
        <>
          {leading}
          <Text style={[styles.label, { color: labelColor }]} numberOfLines={1}>
            {label}
          </Text>
        </>
      )}
    </View>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variant === 'light' && styles.light,
        variant === 'glass' && styles.glass,
        variant === 'ghost' && styles.ghost,
        pressed && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {variant === 'primary' ? (
        <LinearGradient
          colors={colors.gradient}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: layout.buttonHeight,
    borderRadius: radius.pill,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  light: {
    backgroundColor: colors.text,
  },
  glass: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  ghost: {
    backgroundColor: colors.surface,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 30,
  },
  label: {
    ...typography.body,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.45,
  },
});
