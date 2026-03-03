import React, { useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Card, LoadingView, EmptyView, StatusBadge, Btn, FormField, SectionHeader } from '../components';
import { colors, spacing, borderRadius, typography } from '../theme';

// Jobs List
export function JobListScreen({ navigation }: any) {
  const [filter, setFilter] = useState<string | null>(null);
  const qc = useQueryClient();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['jobs', filter],
    queryFn: () => api.get<any[]>(`/jobs${filter ? `?status=${filter}` : ''}`),
  });

  const filters = [null, 'LEAD', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'INVOICED'];

  if (isLoading) return <LoadingView />;

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={styles.filterContent}>
        {filters.map((f) => (
          <Pressable
            key={f || 'all'}
            onPress={() => setFilter(f)}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f ? f.replace('_', ' ') : 'All'}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <FlatList
        data={data || []}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        contentContainerStyle={[styles.list, (!data || data.length === 0) && { flex: 1 }]}
        ListEmptyComponent={<EmptyView message="No jobs found" />}
        renderItem={({ item }) => (
          <Card onPress={() => navigation.navigate('JobDetail', { id: item.id })}>
            <View style={styles.jobHeader}>
              <Text style={[typography.h3, { flex: 1 }]}>{item.title}</Text>
              <StatusBadge status={item.status} />
            </View>
            {item.customer && <Text style={typography.bodySmall}>{item.customer.name}</Text>}
            {item.siteAddress && <Text style={[typography.bodySmall, { marginTop: 2 }]}>{item.siteAddress}</Text>}
          </Card>
        )}
      />
      <View style={styles.fab}>
        <Btn title="+ New Job" onPress={() => navigation.navigate('JobForm')} />
      </View>
    </View>
  );
}

// Job Detail
export function JobDetailScreen({ route, navigation }: any) {
  const { id } = route.params;
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['job', id],
    queryFn: () => api.get<any>(`/jobs/${id}`),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => api.post(`/jobs/${id}/status`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['job', id] }); qc.invalidateQueries({ queryKey: ['jobs'] }); },
    onError: (e: any) => Alert.alert('Error', e?.error?.message || 'Cannot change status'),
  });

  if (isLoading || !data) return <LoadingView />;

  const statusPath = ['LEAD', 'QUOTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'INVOICED', 'PAID'];
  const currentIdx = statusPath.indexOf(data.status);
  const nextStatus = currentIdx < statusPath.length - 1 ? statusPath[currentIdx + 1] : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.detailContent}>
      <View style={styles.jobHeader}>
        <Text style={[typography.h2, { flex: 1 }]}>{data.title}</Text>
        <StatusBadge status={data.status} />
      </View>

      {data.customer && (
        <Card style={{ marginTop: spacing.md }}>
          <Text style={typography.label}>CUSTOMER</Text>
          <Text style={typography.body}>{data.customer.name}</Text>
          {data.customer.phone && <Text style={typography.bodySmall}>{data.customer.phone}</Text>}
        </Card>
      )}

      {data.description && (
        <View style={{ marginTop: spacing.md }}>
          <Text style={typography.label}>DESCRIPTION</Text>
          <Text style={[typography.body, { marginTop: spacing.xs }]}>{data.description}</Text>
        </View>
      )}

      {data.siteAddress && (
        <View style={{ marginTop: spacing.md }}>
          <Text style={typography.label}>SITE ADDRESS</Text>
          <Text style={[typography.body, { marginTop: spacing.xs }]}>{data.siteAddress}</Text>
        </View>
      )}

      {/* Status actions */}
      {data.status !== 'CANCELLED' && data.status !== 'PAID' && (
        <View style={[styles.actions, { marginTop: spacing.xl }]}>
          {nextStatus && (
            <Btn
              title={`Move to ${nextStatus.replace('_', ' ')}`}
              onPress={() => statusMutation.mutate(nextStatus)}
              loading={statusMutation.isPending}
            />
          )}
          <View style={{ height: spacing.sm }} />
          <Btn
            title="Cancel Job"
            variant="danger"
            onPress={() => Alert.alert('Cancel Job', 'Are you sure?', [
              { text: 'No' },
              { text: 'Yes', style: 'destructive', onPress: () => statusMutation.mutate('CANCELLED') },
            ])}
          />
        </View>
      )}

      {/* Notes */}
      <View style={{ marginTop: spacing.xl }}>
        <SectionHeader title={`Notes (${data.notes?.length || 0})`} />
        {data.notes?.map((n: any) => (
          <Card key={n.id}>
            <Text style={typography.body}>{n.note}</Text>
            <Text style={[typography.bodySmall, { marginTop: spacing.xs }]}>{new Date(n.createdAt).toLocaleDateString()}</Text>
          </Card>
        ))}
        <Btn title="+ Add Note" variant="secondary" size="sm" onPress={() => navigation.navigate('AddNote', { jobId: id })} />
      </View>

      {/* Quotes */}
      {data.quotes?.length > 0 && (
        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader title={`Quotes (${data.quotes.length})`} />
          {data.quotes.map((q: any) => (
            <Card key={q.id}>
              <View style={styles.jobHeader}>
                <Text style={typography.body}>{q.quoteNumber}</Text>
                <StatusBadge status={q.status} />
              </View>
              <Text style={typography.h3}>${Number(q.total).toFixed(2)}</Text>
            </Card>
          ))}
        </View>
      )}

      {/* Invoices */}
      {data.invoices?.length > 0 && (
        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader title={`Invoices (${data.invoices.length})`} />
          {data.invoices.map((inv: any) => (
            <Card key={inv.id}>
              <View style={styles.jobHeader}>
                <Text style={typography.body}>{inv.invoiceNumber}</Text>
                <StatusBadge status={inv.status} />
              </View>
              <Text style={typography.h3}>${Number(inv.total).toFixed(2)}</Text>
            </Card>
          ))}
        </View>
      )}

      <View style={{ marginTop: spacing.lg }}>
        <Btn title="Edit Job" variant="secondary" onPress={() => navigation.navigate('JobForm', { job: data })} />
      </View>

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

// Add Note
export function AddNoteScreen({ route, navigation }: any) {
  const { jobId } = route.params;
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  const handleSave = async () => {
    if (!note.trim()) return Alert.alert('Error', 'Note cannot be empty');
    setLoading(true);
    try {
      await api.post(`/jobs/${jobId}/notes`, { note });
      qc.invalidateQueries({ queryKey: ['job', jobId] });
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.error?.message || 'Could not save note');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.formContent}>
        <FormField label="Note" value={note} onChangeText={setNote} placeholder="Enter note..." multiline />
        <Btn title="Save Note" onPress={handleSave} loading={loading} />
      </View>
    </KeyboardAvoidingView>
  );
}

// Job Form (create + edit)
export function JobFormScreen({ route, navigation }: any) {
  const existing = route.params?.job;
  const [form, setForm] = useState({
    title: existing?.title || '',
    description: existing?.description || '',
    siteAddress: existing?.siteAddress || '',
    customerId: existing?.customerId || '',
  });
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.get<any[]>('/customers'),
  });

  const update = (key: string) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

  const handleSave = async () => {
    if (!form.title.trim()) return Alert.alert('Error', 'Title is required');
    if (!form.customerId && !existing) return Alert.alert('Error', 'Please select a customer');
    setLoading(true);
    try {
      if (existing) {
        const { customerId, ...updateData } = form;
        await api.patch(`/jobs/${existing.id}`, updateData);
        qc.invalidateQueries({ queryKey: ['job', existing.id] });
      } else {
        await api.post('/jobs', form);
      }
      qc.invalidateQueries({ queryKey: ['jobs'] });
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.error?.message || 'Could not save job');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        <FormField label="Title *" value={form.title} onChangeText={update('title')} placeholder="e.g. Fix leaking tap" />
        <FormField label="Description" value={form.description} onChangeText={update('description')} placeholder="Details..." multiline />
        <FormField label="Site Address" value={form.siteAddress} onChangeText={update('siteAddress')} placeholder="Job location" />

        {!existing && (
          <>
            <Text style={typography.label}>SELECT CUSTOMER *</Text>
            <View style={{ marginTop: spacing.xs, marginBottom: spacing.md }}>
              {(customers || []).map((c: any) => (
                <Pressable
                  key={c.id}
                  onPress={() => setForm((f) => ({ ...f, customerId: c.id }))}
                  style={[styles.customerOption, form.customerId === c.id && styles.customerOptionActive]}
                >
                  <Text style={[typography.body, form.customerId === c.id && { color: colors.primary, fontWeight: '600' }]}>{c.name}</Text>
                </Pressable>
              ))}
              {(!customers || customers.length === 0) && (
                <Text style={typography.bodySmall}>No customers. Create a customer first.</Text>
              )}
            </View>
          </>
        )}

        <Btn title={existing ? 'Save Changes' : 'Create Job'} onPress={handleSave} loading={loading} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  filterBar: { maxHeight: 50 },
  filterContent: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray200,
    marginRight: spacing.sm,
  },
  filterChipActive: { backgroundColor: colors.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: colors.gray600 },
  filterTextActive: { color: colors.white },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 80 },
  fab: { position: 'absolute', bottom: spacing.lg, left: spacing.lg, right: spacing.lg },
  jobHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailContent: { padding: spacing.lg },
  actions: {},
  formContent: { padding: spacing.lg },
  customerOption: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
  },
  customerOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
});
