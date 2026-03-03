import React, { useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Card, LoadingView, EmptyView, StatusBadge, Btn, FormField, SectionHeader } from '../components';
import { colors, spacing, borderRadius, typography } from '../theme';

// Invoice List
export function InvoiceListScreen({ navigation }: any) {
  const qc = useQueryClient();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => api.get<any[]>('/invoices'),
  });

  if (isLoading) return <LoadingView />;

  return (
    <View style={styles.container}>
      <FlatList
        data={data || []}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        contentContainerStyle={[styles.list, (!data || data.length === 0) && { flex: 1 }]}
        ListEmptyComponent={<EmptyView message="No invoices yet" />}
        renderItem={({ item }) => (
          <Card onPress={() => navigation.navigate('InvoiceDetail', { id: item.id })}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={typography.h3}>{item.invoiceNumber}</Text>
                {item.dueDate && <Text style={typography.bodySmall}>Due: {new Date(item.dueDate).toLocaleDateString()}</Text>}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[typography.h3, { color: colors.gray900 }]}>${Number(item.total).toFixed(2)}</Text>
                <StatusBadge status={item.computedStatus || item.status} />
              </View>
            </View>
          </Card>
        )}
      />
    </View>
  );
}

// Invoice Detail
export function InvoiceDetailScreen({ route, navigation }: any) {
  const { id } = route.params;
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => api.get<any>(`/invoices/${id}`),
  });

  const sendMutation = useMutation({
    mutationFn: () => api.post(`/invoices/${id}/send`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoice', id] }); qc.invalidateQueries({ queryKey: ['invoices'] }); },
  });

  const voidMutation = useMutation({
    mutationFn: () => api.post(`/invoices/${id}/void`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoice', id] }); qc.invalidateQueries({ queryKey: ['invoices'] }); },
  });

  if (isLoading || !data) return <LoadingView />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.detailContent}>
      <View style={styles.row}>
        <Text style={typography.h2}>{data.invoiceNumber}</Text>
        <StatusBadge status={data.computedStatus || data.status} />
      </View>

      <Card style={{ marginTop: spacing.lg }}>
        <DetailRow label="Subtotal" value={`$${Number(data.subtotal).toFixed(2)}`} />
        <DetailRow label="GST" value={`$${Number(data.gstAmount).toFixed(2)}`} />
        {Number(data.discountAmount) > 0 && <DetailRow label="Discount" value={`-$${Number(data.discountAmount).toFixed(2)}`} />}
        <View style={styles.divider} />
        <DetailRow label="Total" value={`$${Number(data.total).toFixed(2)}`} bold />
        {data.dueDate && <DetailRow label="Due Date" value={new Date(data.dueDate).toLocaleDateString()} />}
      </Card>

      {/* Line Items */}
      <SectionHeader title="Line Items" />
      {data.items?.map((item: any, idx: number) => (
        <Card key={item.id || idx}>
          <Text style={typography.body}>{item.description}</Text>
          <Text style={typography.bodySmall}>
            {Number(item.quantity)} x ${Number(item.unitPrice).toFixed(2)} = ${Number(item.lineTotal).toFixed(2)}
          </Text>
        </Card>
      ))}

      {/* Payments */}
      {data.payments?.length > 0 && (
        <View style={{ marginTop: spacing.lg }}>
          <SectionHeader title="Payments" />
          {data.payments.map((p: any) => (
            <Card key={p.id}>
              <View style={styles.row}>
                <Text style={typography.body}>${Number(p.amount).toFixed(2)}</Text>
                <Text style={typography.bodySmall}>{p.method} - {new Date(p.paidAt).toLocaleDateString()}</Text>
              </View>
            </Card>
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
        {data.status === 'DRAFT' && (
          <Btn title="Send Invoice" onPress={() => sendMutation.mutate()} loading={sendMutation.isPending} />
        )}
        {(data.status === 'SENT' || data.computedStatus === 'OVERDUE') && (
          <Btn
            title="Mark as Paid"
            onPress={() => navigation.navigate('MarkPaid', { invoiceId: id, total: data.total })}
          />
        )}
        {data.status !== 'PAID' && data.status !== 'VOID' && (
          <Btn
            title="Void Invoice"
            variant="danger"
            onPress={() => Alert.alert('Void Invoice', 'This cannot be undone.', [
              { text: 'Cancel' },
              { text: 'Void', style: 'destructive', onPress: () => voidMutation.mutate() },
            ])}
          />
        )}
      </View>

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

// Mark Paid
export function MarkPaidScreen({ route, navigation }: any) {
  const { invoiceId, total } = route.params;
  const [amount, setAmount] = useState(String(Number(total)));
  const [method, setMethod] = useState('BANK');
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  const methods = ['BANK', 'CASH', 'CARD', 'OTHER'];

  const handlePay = async () => {
    if (!amount || isNaN(Number(amount))) return Alert.alert('Error', 'Enter a valid amount');
    setLoading(true);
    try {
      await api.post(`/invoices/${invoiceId}/mark-paid`, { amount: Number(amount), method });
      qc.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.error?.message || 'Could not record payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        <FormField label="Amount" value={amount} onChangeText={setAmount} keyboardType="numeric" />

        <Text style={typography.label}>PAYMENT METHOD</Text>
        <View style={styles.methodRow}>
          {methods.map((m) => (
            <Pressable
              key={m}
              onPress={() => setMethod(m)}
              style={[styles.methodChip, method === m && styles.methodChipActive]}
            >
              <Text style={[styles.methodText, method === m && styles.methodTextActive]}>{m}</Text>
            </Pressable>
          ))}
        </View>

        <Btn title="Record Payment" onPress={handlePay} loading={loading} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function DetailRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={[styles.row, { marginBottom: spacing.xs }]}>
      <Text style={bold ? typography.h3 : typography.body}>{label}</Text>
      <Text style={bold ? typography.h3 : typography.body}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  list: { padding: spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailContent: { padding: spacing.lg },
  divider: { height: 1, backgroundColor: colors.gray200, marginVertical: spacing.sm },
  formContent: { padding: spacing.lg },
  methodRow: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.md },
  methodChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.gray200,
  },
  methodChipActive: { backgroundColor: colors.primary },
  methodText: { fontSize: 13, fontWeight: '600', color: colors.gray600 },
  methodTextActive: { color: colors.white },
});
