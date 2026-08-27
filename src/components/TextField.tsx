import React from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing, typography } from '@/theme';

interface TextFieldProps extends TextInputProps {
  label?: string;
  /** Ionicons name shown at the leading edge, as on the sign-in fields. */
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  /** Renders in red under the field and marks the input invalid. */
  error?: string;
  trailing?: React.ReactNode;
}

/** figma: surface fill, 12pt radius, leading icon, #8A8F9E placeholder. */
export function TextField({ label, icon, error, trailing, style, ...rest }: TextFieldProps) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={[styles.field, error !== undefined && styles.fieldError]}>
        {icon ? <Ionicons name={icon} size={18} color={colors.textMuted} /> : null}
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.gradient[0]}
          accessibilityLabel={label}
          accessibilityState={{ disabled: rest.editable === false }}
          {...rest}
        />
        {trailing}
      </View>

      {error !== undefined ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  label: {
    ...typography.bodySmall,
    color: colors.text,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  fieldError: {
    borderColor: colors.negative,
  },
  input: {
    ...typography.body,
    flex: 1,
    color: colors.text,
    paddingVertical: spacing.md,
  },
  error: {
    ...typography.caption,
    color: colors.negative,
  },
});
