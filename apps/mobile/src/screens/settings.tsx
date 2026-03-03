import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { api } from '../api/client';
import { Card, Btn, LoadingView } from '../components';
import { colors, spacing, typography } from '../theme';

export function SettingsScreen({ navigation }: any) {
  const { data: user, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<any>('/me'),
  });

  const { data: business } = useQuery({
    queryKey: ['business'],
    queryFn: () => api.get<any>('/business'),
  });

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            const raw = await SecureStore.getItemAsync('tokens');
            if (raw) {
              const tokens = JSON.parse(raw);
              await api.post('/auth/logout', { refreshToken: tokens.refreshToken }).catch(() => {});
            }
          } finally {
            await SecureStore.deleteItemAsync('tokens');
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          }
        },
      },
    ]);
  };

  if (isLoading) return <LoadingView />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={typography.h1}>Settings</Text>

      <View style={{ marginTop: spacing.xl }}>
        <Text style={typography.label}>ACCOUNT</Text>
        <Card style={{ marginTop: spacing.sm }}>
          <DetailRow label="Name" value={user?.name || '-'} />
          <DetailRow label="Email" value={user?.email || '-'} />
          <DetailRow label="Role" value={user?.role || '-'} />
        </Card>
      </View>

      {business && (
        <View style={{ marginTop: spacing.lg }}>
          <Text style={typography.label}>BUSINESS</Text>
          <Card style={{ marginTop: spacing.sm }}>
            <DetailRow label="Name" value={business.name} />
            {business.abn && <DetailRow label="ABN" value={business.abn} />}
            {business.email && <DetailRow label="Email" value={business.email} />}
            {business.phone && <DetailRow label="Phone" value={business.phone} />}
            <DetailRow label="GST" value={business.gstEnabled ? `Enabled (${(Number(business.gstRate) * 100).toFixed(0)}%)` : 'Disabled'} />
          </Card>
        </View>
      )}

      <View style={{ marginTop: spacing.xxl }}>
        <Btn title="Sign Out" variant="danger" onPress={handleLogout} />
      </View>

      <Text style={[typography.bodySmall, { textAlign: 'center', marginTop: spacing.xl }]}>TradieFlow v1.0.0</Text>
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={typography.bodySmall}>{label}</Text>
      <Text style={typography.body}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  content: { padding: spacing.lg, paddingTop: spacing.xl },
  detailRow: { marginBottom: spacing.sm },
});
