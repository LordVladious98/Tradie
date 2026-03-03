import { StyleSheet } from 'react-native';

export const colors = {
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primaryLight: '#DBEAFE',
  success: '#16A34A',
  successLight: '#DCFCE7',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  danger: '#DC2626',
  dangerLight: '#FEE2E2',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',
  white: '#FFFFFF',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const borderRadius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 999,
};

export const typography = StyleSheet.create({
  h1: { fontSize: 28, fontWeight: '700', color: colors.gray900, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '600', color: colors.gray900 },
  h3: { fontSize: 18, fontWeight: '600', color: colors.gray900 },
  body: { fontSize: 15, color: colors.gray700, lineHeight: 22 },
  bodySmall: { fontSize: 13, color: colors.gray500, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '600', color: colors.gray600, textTransform: 'uppercase', letterSpacing: 0.5 },
});

export const shadows = {
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
};
