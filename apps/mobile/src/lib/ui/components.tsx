import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
  ViewProps,
} from 'react-native';
import { palette, radii, spacing } from './theme';

type CardTone = 'default' | 'muted' | 'raised';

type CardProps = ViewProps & {
  tone?: CardTone;
  padding?: number;
  gap?: number;
};

export function Card({ tone = 'default', padding = spacing.lg, gap = spacing.md, style, ...rest }: CardProps) {
  return (
    <View
      {...rest}
      style={[
        styles.card,
        tone === 'muted' && styles.cardMuted,
        tone === 'raised' && styles.cardRaised,
        { padding, gap },
        style,
      ]}
    />
  );
}

type SectionHeaderProps = ViewProps & {
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

export function SectionHeader({ title, subtitle, action, style, ...rest }: SectionHeaderProps) {
  return (
    <View {...rest} style={[styles.sectionHeader, style]}>
      <View style={styles.sectionHeaderText}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {action ? <View style={styles.sectionAction}>{action}</View> : null}
    </View>
  );
}

export function FieldLabel({ style, children, ...rest }: TextProps) {
  return (
    <Text
      {...rest}
      style={[
        styles.fieldLabel,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

type InputProps = TextInputProps & {
  invalid?: boolean;
};

export const Input = forwardRef<TextInput, InputProps>(({ style, invalid, ...rest }, ref) => {
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={palette.textMuted}
      {...rest}
      style={[
        styles.input,
        invalid && styles.inputInvalid,
        rest.multiline && styles.inputMultiline,
        style,
      ]}
    />
  );
});
Input.displayName = 'Input';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';

const BUTTON_VARIANTS: Record<ButtonVariant, { bg: string; color: string; borderColor?: string }> = {
  primary: { bg: palette.accentBlue, color: '#ffffff' },
  secondary: { bg: palette.accentGreen, color: '#ffffff' },
  ghost: { bg: palette.surfaceMuted, color: palette.textPrimary },
  outline: { bg: 'transparent', color: palette.textSecondary, borderColor: palette.borderMuted },
  danger: { bg: palette.accentRed, color: '#ffffff' },
};

type ButtonProps = TouchableOpacityProps & {
  label: string;
  variant?: ButtonVariant;
  compact?: boolean;
  fullWidth?: boolean;
};

export function Button({
  label,
  variant = 'primary',
  compact = false,
  fullWidth = true,
  style,
  disabled,
  ...rest
}: ButtonProps) {
  const variantStyle = BUTTON_VARIANTS[variant];
  return (
    <TouchableOpacity
      {...rest}
      disabled={disabled}
      style={[
        styles.buttonBase,
        compact && styles.buttonCompact,
        {
          backgroundColor: variantStyle.bg,
          paddingVertical: compact ? spacing.sm : spacing.md + 2,
        },
        fullWidth && styles.buttonFullWidth,
        variantStyle.borderColor ? { borderWidth: StyleSheet.hairlineWidth, borderColor: variantStyle.borderColor } : null,
        disabled && styles.buttonDisabled,
        style,
      ]}
      activeOpacity={0.85}
    >
      <Text
        style={[
          styles.buttonLabel,
          compact && styles.buttonLabelCompact,
          { color: variantStyle.color },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

type BadgeTone = 'default' | 'success' | 'info' | 'warning' | 'danger';

const BADGES: Record<BadgeTone, { bg: string; color: string; border: string }> = {
  default: {
    bg: 'rgba(148, 163, 184, 0.12)',
    color: palette.textSecondary,
    border: 'rgba(148, 163, 184, 0.4)',
  },
  success: {
    bg: 'rgba(16, 185, 129, 0.12)',
    color: palette.accentGreenSoft,
    border: 'rgba(16, 185, 129, 0.4)',
  },
  info: {
    bg: 'rgba(96, 165, 250, 0.12)',
    color: palette.accentBlueSoft,
    border: 'rgba(96, 165, 250, 0.4)',
  },
  warning: {
    bg: 'rgba(251, 191, 36, 0.12)',
    color: palette.accentYellow,
    border: 'rgba(251, 191, 36, 0.4)',
  },
  danger: {
    bg: 'rgba(248, 113, 113, 0.12)',
    color: palette.accentRed,
    border: 'rgba(248, 113, 113, 0.4)',
  },
};

type BadgeProps = TextProps & {
  label: string;
  tone?: BadgeTone;
  customColors?: { bg: string; color: string; border?: string };
};

export function Badge({ label, tone = 'default', customColors, style, ...rest }: BadgeProps) {
  const colors = customColors ?? BADGES[tone];
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border ?? colors.bg,
        },
      ]}
    >
      <Text
        {...rest}
        style={[
          styles.badgeLabel,
          { color: colors.color },
          style,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

type StateNoticeTone = 'default' | 'muted' | 'error';

type StateNoticeProps = ViewProps & {
  title: string;
  message?: string;
  tone?: StateNoticeTone;
  action?: ReactNode;
};

export function StateNotice({ title, message, tone = 'default', action, style, ...rest }: StateNoticeProps) {
  return (
    <View
      {...rest}
      style={[
        styles.stateNotice,
        tone === 'muted' && styles.stateNoticeMuted,
        tone === 'error' && styles.stateNoticeError,
        style,
      ]}
    >
      <Text style={tone === 'error' ? styles.stateNoticeTitleError : styles.stateNoticeTitle}>{title}</Text>
      {message ? (
        <Text style={tone === 'error' ? styles.stateNoticeMessageError : styles.stateNoticeMessage}>{message}</Text>
      ) : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  cardMuted: {
    backgroundColor: palette.surfaceMuted,
    borderColor: palette.borderMuted,
  },
  cardRaised: {
    backgroundColor: palette.surfaceRaised,
    borderColor: palette.borderMuted,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sectionHeaderText: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  sectionSubtitle: {
    color: palette.textSecondary,
  },
  sectionAction: {
    marginLeft: spacing.sm,
  },
  fieldLabel: {
    fontSize: 12,
    letterSpacing: 0.5,
    color: palette.textMuted,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: palette.borderMuted,
    backgroundColor: palette.surfaceMuted,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
    color: palette.textPrimary,
  },
  inputMultiline: {
    minHeight: 80,
  },
  inputInvalid: {
    borderColor: palette.accentRed,
  },
  buttonBase: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  buttonCompact: {
    paddingHorizontal: spacing.md,
  },
  buttonFullWidth: {
    alignSelf: 'stretch',
  },
  buttonLabel: {
    fontWeight: '700',
    fontSize: 16,
  },
  buttonLabelCompact: {
    fontSize: 13,
    letterSpacing: 0.5,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  badge: {
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 1,
  },
  badgeLabel: {
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.3,
  },
  stateNotice: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.borderMuted,
    borderRadius: radii.md,
    padding: spacing.lg,
    gap: spacing.xs,
    backgroundColor: palette.surfaceRaised,
  },
  stateNoticeMuted: {
    backgroundColor: palette.surfaceMuted,
  },
  stateNoticeError: {
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderColor: 'rgba(248, 113, 113, 0.4)',
  },
  stateNoticeTitle: {
    color: palette.textPrimary,
    fontWeight: '700',
  },
  stateNoticeTitleError: {
    color: palette.accentRed,
    fontWeight: '700',
  },
  stateNoticeMessage: {
    color: palette.textSecondary,
  },
  stateNoticeMessageError: {
    color: palette.accentRose,
  },
});
