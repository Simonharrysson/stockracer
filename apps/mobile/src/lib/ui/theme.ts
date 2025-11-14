import { Platform } from 'react-native';

export const palette = {
  background: '#020617',
  surface: '#0f172a',
  surfaceMuted: '#111b2f',
  surfaceRaised: '#0b1220',
  border: '#1f2937',
  borderMuted: '#1d2534',
  textPrimary: '#f8fafc',
  textSecondary: '#94a3b8',
  textMuted: '#9ca3af',
  accentBlue: '#2563eb',
  accentBlueSoft: '#93c5fd',
  accentIndigo: '#6366f1',
  accentGreen: '#10b981',
  accentGreenSoft: '#34d399',
  accentYellow: '#fbbf24',
  accentRed: '#f87171',
  accentRose: '#fda4af',
};

export const spacing = Object.freeze({
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
});

export const radii = Object.freeze({
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
});

export const typography = Object.freeze({
  headingWeight: '800',
  strongWeight: '700',
  regularWeight: '500',
});

export const shadow = Object.freeze({
  soft: {
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: Platform.OS === 'android' ? 6 : 0,
  },
});

export const theme = {
  palette,
  spacing,
  radii,
  typography,
  shadow,
} as const;

export type Theme = typeof theme;
