import React, { useState } from 'react';
import { Alert, FlatList, Image, KeyboardAvoidingView, Linking, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';
import { api } from '../api/client';
import { Card, LoadingView, EmptyView, StatusBadge, Btn, FormField, SectionHeader } from '../components';
import { colors, spacing, borderRadius, typography } from '../theme';

const API_BASE = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3001';

// Jobs List
export function JobListScreen({ navigation }: any) {
  const [filter, setFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const qc = useQueryClient();
  const { data: resp, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['jobs', filter, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filter) params.set('status', filter);
      if (search) params.set('q', search);
      const qs = params.toString();
      return api.get<any>(`/jobs${qs ? `?${qs}` : ''}`);
    },
  });
  const data = resp?.data || resp || [];

  const filters = [null, 'LEAD', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'INVOICED'];

  if (isLoading) return <LoadingView />;

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search jobs..."
          placeholderTextColor={colors.gray400}
          value={search}
          onChangeText={setSearch}
        />
      </View>
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
        data={data}
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

      {/* Photos */}
      <View style={{ marginTop: spacing.xl }}>
        <SectionHeader title={`Photos (${data.photos?.length || 0})`} />
        {data.photos?.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
            {data.photos.map((p: any) => (
              <Image key={p.id} source={{ uri: `${API_BASE}${p.url}` }} style={styles.photo} />
            ))}
          </ScrollView>
        )}
        <Btn title="+ Add Photo" variant="secondary" size="sm" onPress={() => navigation.navigate('AddPhoto', { jobId: id })} />
      </View>

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

      {/* Scheduled dates */}
      {(data.scheduledStart || data.scheduledEnd) && (
        <Card style={{ marginTop: spacing.md }}>
          <Text style={typography.label}>SCHEDULE</Text>
          {data.scheduledStart && <Text style={typography.body}>Start: {new Date(data.scheduledStart).toLocaleDateString()}</Text>}
          {data.scheduledEnd && <Text style={typography.body}>End: {new Date(data.scheduledEnd).toLocaleDateString()}</Text>}
        </Card>
      )}

      {/* Assigned user */}
      {data.assignedUser && (
        <Card style={{ marginTop: spacing.md }}>
          <Text style={typography.label}>ASSIGNED TO</Text>
          <Text style={typography.body}>{data.assignedUser.name}</Text>
        </Card>
      )}

      {/* Quotes */}
      <View style={{ marginTop: spacing.xl }}>
        <SectionHeader title={`Quotes (${data.quotes?.length || 0})`} />
        {data.quotes?.map((q: any) => (
          <Card key={q.id}>
            <View style={styles.jobHeader}>
              <Text style={typography.body}>{q.quoteNumber}</Text>
              <StatusBadge status={q.status} />
            </View>
            <Text style={typography.h3}>${Number(q.total).toFixed(2)}</Text>
            <View style={{ flexDirection: 'row', marginTop: spacing.sm, gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Btn title="PDF" variant="secondary" size="sm" onPress={() => Linking.openURL(`${API_BASE}/quotes/${q.id}/pdf`)} />
              </View>
              {q.status === 'ACCEPTED' && (
                <View style={{ flex: 1 }}>
                  <Btn title="To Invoice" size="sm" onPress={async () => {
                    try {
                      await api.post(`/invoices/from-quote/${q.id}`);
                      qc.invalidateQueries({ queryKey: ['job', id] });
                      Alert.alert('Done', 'Invoice created from quote');
                    } catch (e: any) { Alert.alert('Error', e?.message || 'Could not convert'); }
                  }} />
                </View>
              )}
            </View>
          </Card>
        ))}
        <Btn title="+ Create Quote" variant="secondary" size="sm" onPress={() => navigation.navigate('QuoteForm', { jobId: id })} />
      </View>

      {/* Invoices */}
      <View style={{ marginTop: spacing.xl }}>
        <SectionHeader title={`Invoices (${data.invoices?.length || 0})`} />
        {data.invoices?.map((inv: any) => (
          <Card key={inv.id}>
            <View style={styles.jobHeader}>
              <Text style={typography.body}>{inv.invoiceNumber}</Text>
              <StatusBadge status={inv.status} />
            </View>
            <Text style={typography.h3}>${Number(inv.total).toFixed(2)}</Text>
          </Card>
        ))}
      </View>

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
    scheduledStart: existing?.scheduledStart ? existing.scheduledStart.slice(0, 10) : '',
    scheduledEnd: existing?.scheduledEnd ? existing.scheduledEnd.slice(0, 10) : '',
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
        <FormField label="Scheduled Start (YYYY-MM-DD)" value={form.scheduledStart} onChangeText={update('scheduledStart')} placeholder="e.g. 2026-03-15" />
        <FormField label="Scheduled End (YYYY-MM-DD)" value={form.scheduledEnd} onChangeText={update('scheduledEnd')} placeholder="e.g. 2026-03-16" />

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

// Add Photo
export function AddPhotoScreen({ route, navigation }: any) {
  const { jobId } = route.params;
  const [caption, setCaption] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission needed', 'Camera roll access is required to upload photos.');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission needed', 'Camera access is required to take photos.');
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
  };

  const handleUpload = async () => {
    if (!imageUri) return Alert.alert('Error', 'Please select a photo first');
    setLoading(true);
    try {
      const formData = new FormData();
      const filename = imageUri.split('/').pop() || 'photo.jpg';
      formData.append('file', { uri: imageUri, name: filename, type: 'image/jpeg' } as any);
      if (caption) formData.append('caption', caption);

      const tokens = await (await import('expo-secure-store')).getItemAsync('tokens');
      const accessToken = tokens ? JSON.parse(tokens).accessToken : '';

      await fetch(`${API_BASE}/jobs/${jobId}/photos`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });

      qc.invalidateQueries({ queryKey: ['job', jobId] });
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', 'Could not upload photo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        <View style={styles.photoButtons}>
          <View style={{ flex: 1, marginRight: spacing.sm }}>
            <Btn title="Take Photo" variant="secondary" onPress={takePhoto} />
          </View>
          <View style={{ flex: 1 }}>
            <Btn title="Choose Photo" variant="secondary" onPress={pickImage} />
          </View>
        </View>

        {imageUri && (
          <Image source={{ uri: imageUri }} style={styles.photoPreview} resizeMode="cover" />
        )}

        <FormField label="Caption (optional)" value={caption} onChangeText={setCaption} placeholder="Describe the photo..." />
        <Btn title="Upload Photo" onPress={handleUpload} loading={loading} disabled={!imageUri} />
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
  photo: {
    width: 120,
    height: 120,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
  },
  photoButtons: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  searchRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  searchInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.gray900,
  },
});
