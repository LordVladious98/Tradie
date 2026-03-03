import React, { useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Card, LoadingView, EmptyView, StatusBadge, Btn, FormField, SectionHeader } from '../components';
import { colors, spacing, borderRadius, typography, shadows } from '../theme';

// Customer List
export function CustomerListScreen({ navigation }: any) {
  const [search, setSearch] = useState('');
  const qc = useQueryClient();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['customers', search],
    queryFn: () => api.get<any[]>(`/customers${search ? `?q=${encodeURIComponent(search)}` : ''}`),
  });

  if (isLoading) return <LoadingView />;

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search customers..."
          placeholderTextColor={colors.gray400}
          value={search}
          onChangeText={setSearch}
        />
      </View>
      <FlatList
        data={data || []}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        contentContainerStyle={[styles.list, (!data || data.length === 0) && { flex: 1 }]}
        ListEmptyComponent={<EmptyView message="No customers yet" />}
        renderItem={({ item }) => (
          <Card onPress={() => navigation.navigate('CustomerDetail', { id: item.id })}>
            <Text style={typography.h3}>{item.name}</Text>
            {item.email && <Text style={typography.bodySmall}>{item.email}</Text>}
            {item.phone && <Text style={typography.bodySmall}>{item.phone}</Text>}
          </Card>
        )}
      />
      <View style={styles.fab}>
        <Btn title="+ Add Customer" onPress={() => navigation.navigate('CustomerForm')} />
      </View>
    </View>
  );
}

// Customer Detail
export function CustomerDetailScreen({ route, navigation }: any) {
  const { id } = route.params;
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => api.get<any>(`/customers/${id}`),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/customers/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); navigation.goBack(); },
  });

  if (isLoading || !data) return <LoadingView />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.detailContent}>
      <Text style={typography.h2}>{data.name}</Text>

      <View style={styles.detailSection}>
        <SectionHeader title="Contact Info" />
        <Card>
          {data.email && <DetailRow label="Email" value={data.email} />}
          {data.phone && <DetailRow label="Phone" value={data.phone} />}
          {data.address && <DetailRow label="Address" value={data.address} />}
          {!data.email && !data.phone && !data.address && <Text style={typography.bodySmall}>No contact info</Text>}
        </Card>
      </View>

      {data.notes && (
        <View style={styles.detailSection}>
          <SectionHeader title="Notes" />
          <Card><Text style={typography.body}>{data.notes}</Text></Card>
        </View>
      )}

      <View style={styles.actions}>
        <Btn title="Edit" onPress={() => navigation.navigate('CustomerForm', { customer: data })} variant="secondary" />
        <View style={{ width: spacing.sm }} />
        <Btn
          title="Delete"
          variant="danger"
          onPress={() => Alert.alert('Delete Customer', 'Are you sure?', [
            { text: 'Cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
          ])}
        />
      </View>
    </ScrollView>
  );
}

// Customer Form (create + edit)
export function CustomerFormScreen({ route, navigation }: any) {
  const existing = route.params?.customer;
  const [form, setForm] = useState({
    name: existing?.name || '',
    email: existing?.email || '',
    phone: existing?.phone || '',
    address: existing?.address || '',
    notes: existing?.notes || '',
  });
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  const update = (key: string) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) return Alert.alert('Error', 'Name is required');
    setLoading(true);
    try {
      if (existing) {
        await api.patch(`/customers/${existing.id}`, form);
      } else {
        await api.post('/customers', form);
      }
      qc.invalidateQueries({ queryKey: ['customers'] });
      if (existing) qc.invalidateQueries({ queryKey: ['customer', existing.id] });
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.error?.message || 'Could not save customer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        <FormField label="Name *" value={form.name} onChangeText={update('name')} placeholder="Customer name" />
        <FormField label="Email" value={form.email} onChangeText={update('email')} placeholder="email@example.com" keyboardType="email-address" autoCapitalize="none" />
        <FormField label="Phone" value={form.phone} onChangeText={update('phone')} placeholder="Phone number" keyboardType="phone-pad" />
        <FormField label="Address" value={form.address} onChangeText={update('address')} placeholder="Street address" />
        <FormField label="Notes" value={form.notes} onChangeText={update('notes')} placeholder="Any notes..." multiline />
        <Btn title={existing ? 'Save Changes' : 'Create Customer'} onPress={handleSave} loading={loading} />
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
  searchBar: { padding: spacing.lg, paddingBottom: spacing.sm },
  searchInput: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.gray900,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 80 },
  fab: { position: 'absolute', bottom: spacing.lg, left: spacing.lg, right: spacing.lg },
  detailContent: { padding: spacing.lg },
  detailSection: { marginTop: spacing.lg },
  detailRow: { marginBottom: spacing.sm },
  actions: { flexDirection: 'row', marginTop: spacing.xl },
  formContent: { padding: spacing.lg },
});
