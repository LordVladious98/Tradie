import React, { useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Card, LoadingView, EmptyView, Btn, FormField, StatusBadge } from '../components';
import { colors, spacing, typography } from '../theme';

// Staff List
export function StaffListScreen({ navigation }: any) {
  const qc = useQueryClient();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['staff'],
    queryFn: () => api.get<any[]>('/staff'),
  });

  if (isLoading) return <LoadingView />;

  return (
    <View style={styles.container}>
      <FlatList
        data={data || []}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        contentContainerStyle={[styles.list, (!data || data.length === 0) && { flex: 1 }]}
        ListEmptyComponent={<EmptyView message="No staff members" />}
        renderItem={({ item }) => (
          <Card onPress={() => navigation.navigate('StaffDetail', { staff: item })}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={typography.h3}>{item.name}</Text>
                <Text style={typography.bodySmall}>{item.email}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <StatusBadge status={item.role} />
                {!item.isActive && <Text style={[typography.bodySmall, { color: colors.danger, marginTop: 4 }]}>Inactive</Text>}
              </View>
            </View>
          </Card>
        )}
      />
      <View style={styles.fab}>
        <Btn title="+ Add Staff" onPress={() => navigation.navigate('StaffForm')} />
      </View>
    </View>
  );
}

// Staff Detail
export function StaffDetailScreen({ route, navigation }: any) {
  const { staff } = route.params;
  const qc = useQueryClient();

  const deactivateMutation = useMutation({
    mutationFn: () => api.delete(`/staff/${staff.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff'] }); navigation.goBack(); },
    onError: (e: any) => Alert.alert('Error', e?.error?.message || 'Could not deactivate staff member'),
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.detailContent}>
      <Text style={typography.h2}>{staff.name}</Text>
      <View style={{ marginTop: spacing.xs }}>
        <StatusBadge status={staff.role} />
      </View>

      <Card style={{ marginTop: spacing.lg }}>
        <DetailRow label="Email" value={staff.email} />
        <DetailRow label="Status" value={staff.isActive ? 'Active' : 'Inactive'} />
        <DetailRow label="Joined" value={new Date(staff.createdAt).toLocaleDateString()} />
      </Card>

      <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
        <Btn title="Edit" variant="secondary" onPress={() => navigation.navigate('StaffForm', { staff })} />
        {staff.isActive && (
          <Btn
            title="Deactivate"
            variant="danger"
            onPress={() => Alert.alert('Deactivate Staff', `Remove ${staff.name}?`, [
              { text: 'Cancel' },
              { text: 'Deactivate', style: 'destructive', onPress: () => deactivateMutation.mutate() },
            ])}
            loading={deactivateMutation.isPending}
          />
        )}
      </View>
    </ScrollView>
  );
}

// Staff Form (create + edit)
export function StaffFormScreen({ route, navigation }: any) {
  const existing = route.params?.staff;
  const [form, setForm] = useState({
    name: existing?.name || '',
    email: existing?.email || '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  const update = (key: string) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) return Alert.alert('Error', 'Name is required');
    if (!form.email.trim()) return Alert.alert('Error', 'Email is required');
    if (!existing && form.password.length < 8) return Alert.alert('Error', 'Password must be at least 8 characters');

    setLoading(true);
    try {
      if (existing) {
        const updateData: any = { name: form.name, email: form.email };
        await api.patch(`/staff/${existing.id}`, updateData);
      } else {
        await api.post('/staff', form);
      }
      qc.invalidateQueries({ queryKey: ['staff'] });
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.error?.message || 'Could not save staff member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        <FormField label="Name *" value={form.name} onChangeText={update('name')} placeholder="Full name" />
        <FormField label="Email *" value={form.email} onChangeText={update('email')} placeholder="staff@example.com" keyboardType="email-address" autoCapitalize="none" />
        {!existing && (
          <FormField label="Password *" value={form.password} onChangeText={update('password')} placeholder="Min. 8 characters" secureTextEntry />
        )}
        <Btn title={existing ? 'Save Changes' : 'Add Staff Member'} onPress={handleSave} loading={loading} />
      </ScrollView>
    </KeyboardAvoidingView>
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
  list: { padding: spacing.lg, paddingBottom: 80 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fab: { position: 'absolute', bottom: spacing.lg, left: spacing.lg, right: spacing.lg },
  detailContent: { padding: spacing.lg },
  detailRow: { marginBottom: spacing.sm },
  formContent: { padding: spacing.lg },
});
