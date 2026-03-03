import React from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { Card, LoadingView, EmptyView } from '../components';
import { colors, spacing, typography } from '../theme';

export function AuditLogScreen() {
  const { data: resp, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => api.get<any>('/audit-logs'),
  });
  const data = resp?.data || [];

  if (isLoading) return <LoadingView />;

  return (
    <View style={styles.container}>
      <FlatList
        data={data}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        contentContainerStyle={[styles.list, data.length === 0 && { flex: 1 }]}
        ListEmptyComponent={<EmptyView message="No activity yet" />}
        renderItem={({ item }) => (
          <Card>
            <View style={styles.row}>
              <Text style={[typography.body, { flex: 1 }]}>{item.action}</Text>
              <Text style={[typography.bodySmall, { color: colors.gray400 }]}>{item.entityType}</Text>
            </View>
            <Text style={typography.bodySmall}>{item.user?.name || 'System'}</Text>
            <Text style={[typography.bodySmall, { color: colors.gray400, marginTop: 2 }]}>
              {new Date(item.createdAt).toLocaleString()}
            </Text>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  list: { padding: spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
