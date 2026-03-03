import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { api } from '../api/client';
import { Card, Btn, LoadingView, FormField } from '../components';
import { colors, spacing, typography } from '../theme';

export function SettingsScreen({ navigation }: any) {
  const qc = useQueryClient();
  const { data: user, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<any>('/me'),
  });

  const { data: business } = useQuery({
    queryKey: ['business'],
    queryFn: () => api.get<any>('/business'),
  });

  const [abn, setAbn] = useState('');
  const [abnLoading, setAbnLoading] = useState(false);

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

  const handleVerifyAbn = async () => {
    const clean = abn.replace(/\s/g, '');
    if (clean.length !== 11) return Alert.alert('Error', 'ABN must be 11 digits');
    setAbnLoading(true);
    try {
      const result: any = await api.post('/business/verify-abn', { abn: clean });
      qc.invalidateQueries({ queryKey: ['business'] });
      Alert.alert('Verified', `ABN verified for: ${result.entityName}`);
      setAbn('');
    } catch (e: any) {
      Alert.alert('Verification Failed', e?.message || 'Invalid ABN');
    } finally {
      setAbnLoading(false);
    }
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
            {business.abn && (
              <View style={styles.abnRow}>
                <DetailRow label="ABN" value={business.abn} />
                {business.abnVerified
                  ? <Text style={styles.verified}>Verified</Text>
                  : <Text style={styles.unverified}>Unverified</Text>
                }
              </View>
            )}
            {business.abnEntityName && <DetailRow label="Registered As" value={business.abnEntityName} />}
            {business.email && <DetailRow label="Email" value={business.email} />}
            {business.phone && <DetailRow label="Phone" value={business.phone} />}
            <DetailRow label="GST" value={business.gstEnabled ? `Enabled (${(Number(business.gstRate) * 100).toFixed(0)}%)` : 'Disabled'} />
          </Card>
        </View>
      )}

      {/* ABN Verification */}
      {user?.role === 'OWNER' && !business?.abnVerified && (
        <Card style={{ marginTop: spacing.lg }}>
          <Text style={typography.label}>VERIFY YOUR ABN</Text>
          <Text style={[typography.bodySmall, { marginTop: spacing.xs, marginBottom: spacing.sm }]}>
            Verify your Australian Business Number to confirm your business is legitimate.
          </Text>
          <FormField label="ABN (11 digits)" value={abn} onChangeText={setAbn} placeholder="e.g. 51824753556" keyboardType="numeric" />
          <Btn title="Verify ABN" onPress={handleVerifyAbn} loading={abnLoading} size="sm" />
        </Card>
      )}

      {/* Quick links */}
      {user?.role === 'OWNER' && (
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <Btn title="Subscription" variant="secondary" onPress={() => navigation.navigate('Subscription')} />
          <Btn title="Audit Log" variant="secondary" onPress={() => navigation.navigate('AuditLog')} />
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
  abnRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  verified: { fontSize: 12, fontWeight: '700', color: colors.success, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: '#dcfce7', borderRadius: 4, overflow: 'hidden' },
  unverified: { fontSize: 12, fontWeight: '700', color: colors.warning, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: '#fef3c7', borderRadius: 4, overflow: 'hidden' },
});
