import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, TextInputProps } from 'react-native';
import { colors, spacing, borderRadius, shadows, typography } from './theme';

// Card
export function Card({ children, style, onPress }: { children: React.ReactNode; style?: any; onPress?: () => void }) {
  const content = (
    <View style={[styles.card, style]}>
      {children}
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{content}</Pressable> : content;
}

// Button
export function Btn({ title, onPress, variant = 'primary', size = 'md', disabled, loading }: {
  title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md'; disabled?: boolean; loading?: boolean;
}) {
  const bg = variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : variant === 'secondary' ? colors.gray200 : 'transparent';
  const fg = variant === 'primary' || variant === 'danger' ? colors.white : colors.gray800;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.btn, { backgroundColor: bg, opacity: disabled ? 0.5 : 1, paddingVertical: size === 'sm' ? 8 : 14 }]}
    >
      {loading ? <ActivityIndicator color={fg} size="small" /> : <Text style={[styles.btnText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

// FormField
export function FormField({ label, value, onChangeText, placeholder, multiline, keyboardType, secureTextEntry, ...rest }: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder?: string;
} & TextInputProps) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.gray400}
        multiline={multiline}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        style={[styles.fieldInput, multiline && { minHeight: 80, textAlignVertical: 'top' }]}
        {...rest}
      />
    </View>
  );
}

// StatusBadge
const statusColors: Record<string, { bg: string; fg: string }> = {
  LEAD: { bg: colors.gray200, fg: colors.gray700 },
  QUOTED: { bg: '#EDE9FE', fg: '#7C3AED' },
  SCHEDULED: { bg: colors.primaryLight, fg: colors.primary },
  IN_PROGRESS: { bg: colors.warningLight, fg: colors.warning },
  COMPLETED: { bg: colors.successLight, fg: colors.success },
  INVOICED: { bg: '#FEF3C7', fg: '#B45309' },
  PAID: { bg: colors.successLight, fg: colors.success },
  CANCELLED: { bg: colors.dangerLight, fg: colors.danger },
  DRAFT: { bg: colors.gray200, fg: colors.gray600 },
  SENT: { bg: colors.primaryLight, fg: colors.primary },
  ACCEPTED: { bg: colors.successLight, fg: colors.success },
  DECLINED: { bg: colors.dangerLight, fg: colors.danger },
  OVERDUE: { bg: colors.dangerLight, fg: colors.danger },
  VOID: { bg: colors.gray200, fg: colors.gray500 },
};

export function StatusBadge({ status }: { status: string }) {
  const c = statusColors[status] || { bg: colors.gray200, fg: colors.gray600 };
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.fg }]}>{status.replace('_', ' ')}</Text>
    </View>
  );
}

// Loading / Empty
export function LoadingView() {
  return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
}

export function EmptyView({ message }: { message: string }) {
  return <View style={styles.center}><Text style={typography.body}>{message}</Text></View>;
}

// Section header
export function SectionHeader({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={typography.label}>{title}</Text>
      {action && <Pressable onPress={action.onPress}><Text style={styles.sectionAction}>{action.label}</Text></Pressable>}
    </View>
  );
}

// Stat card for dashboard
export function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color || colors.primary }]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  btn: {
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  fieldContainer: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray600,
    marginBottom: spacing.xs,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.gray900,
    backgroundColor: colors.white,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  sectionAction: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderLeftWidth: 3,
    ...shadows.sm,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.gray900,
  },
  statLabel: {
    fontSize: 12,
    color: colors.gray500,
    marginTop: 2,
  },
});
