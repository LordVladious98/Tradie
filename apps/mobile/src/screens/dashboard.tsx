import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { LoadingView, StatCard } from '../components';
import { colors, spacing, typography } from '../theme';

export function DashboardScreen() {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['summary'],
    queryFn: () => api.get<{ jobsTodayCount: number; overdueInvoicesCount: number; outstandingTotal: number }>('/reports/summary'),
  });

  if (isLoading) return <LoadingView />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
    >
      <Text style={typography.h1}>Dashboard</Text>
      <Text style={[typography.bodySmall, { marginBottom: spacing.xl }]}>Business overview</Text>

      <View style={styles.statsRow}>
        <StatCard label="Jobs Today" value={data?.jobsTodayCount ?? 0} color={colors.primary} />
        <View style={{ width: spacing.sm }} />
        <StatCard label="Overdue" value={data?.overdueInvoicesCount ?? 0} color={colors.danger} />
      </View>

      <View style={[styles.statsRow, { marginTop: spacing.sm }]}>
        <StatCard
          label="Outstanding"
          value={`$${(data?.outstandingTotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          color={colors.warning}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  content: { padding: spacing.lg, paddingTop: spacing.xl },
  statsRow: { flexDirection: 'row' },
});
