import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Btn, Card, FormField, LoadingView } from '../components';
import { colors, spacing, borderRadius, typography } from '../theme';

type LineItem = { description: string; quantity: string; unitPrice: string };

export function QuoteFormScreen({ route, navigation }: any) {
  const { jobId } = route.params;
  const [items, setItems] = useState<LineItem[]>([{ description: '', quantity: '1', unitPrice: '' }]);
  const [discount, setDiscount] = useState('0');
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => api.get<any>(`/jobs/${jobId}`),
  });

  const updateItem = (idx: number, key: keyof LineItem, value: string) => {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [key]: value } : item)));
  };

  const addItem = () => setItems((prev) => [...prev, { description: '', quantity: '1', unitPrice: '' }]);

  const removeItem = (idx: number) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const subtotal = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

  const handleSave = async () => {
    const validItems = items.filter((i) => i.description.trim() && parseFloat(i.unitPrice) > 0);
    if (validItems.length === 0) return Alert.alert('Error', 'Add at least one line item with a description and price');

    setLoading(true);
    try {
      await api.post('/quotes', {
        jobId,
        items: validItems.map((i) => ({
          description: i.description,
          quantity: parseFloat(i.quantity) || 1,
          unitPrice: parseFloat(i.unitPrice),
        })),
        discountAmount: parseFloat(discount) || 0,
      });
      qc.invalidateQueries({ queryKey: ['job', jobId] });
      qc.invalidateQueries({ queryKey: ['quotes'] });
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.error?.message || 'Could not create quote');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) return <LoadingView />;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {job && (
          <Card style={{ marginBottom: spacing.lg }}>
            <Text style={typography.label}>JOB</Text>
            <Text style={typography.body}>{job.title}</Text>
            {job.customer && <Text style={typography.bodySmall}>{job.customer.name}</Text>}
          </Card>
        )}

        <Text style={[typography.label, { marginBottom: spacing.sm }]}>LINE ITEMS</Text>

        {items.map((item, idx) => (
          <Card key={idx} style={styles.lineItemCard}>
            <View style={styles.lineItemHeader}>
              <Text style={typography.bodySmall}>Item {idx + 1}</Text>
              {items.length > 1 && (
                <Pressable onPress={() => removeItem(idx)}>
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              )}
            </View>
            <FormField label="Description" value={item.description} onChangeText={(v) => updateItem(idx, 'description', v)} placeholder="e.g. Labour - plumbing repair" />
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: spacing.sm }}>
                <FormField label="Qty" value={item.quantity} onChangeText={(v) => updateItem(idx, 'quantity', v)} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <FormField label="Unit Price ($)" value={item.unitPrice} onChangeText={(v) => updateItem(idx, 'unitPrice', v)} keyboardType="numeric" />
              </View>
            </View>
            {parseFloat(item.quantity) > 0 && parseFloat(item.unitPrice) > 0 && (
              <Text style={[typography.bodySmall, { textAlign: 'right' }]}>
                Line total: ${(parseFloat(item.quantity) * parseFloat(item.unitPrice)).toFixed(2)}
              </Text>
            )}
          </Card>
        ))}

        <Btn title="+ Add Line Item" variant="secondary" size="sm" onPress={addItem} />

        <View style={{ marginTop: spacing.lg }}>
          <FormField label="Discount ($)" value={discount} onChangeText={setDiscount} keyboardType="numeric" />
        </View>

        <Card style={{ marginTop: spacing.md }}>
          <View style={styles.totalRow}>
            <Text style={typography.body}>Subtotal</Text>
            <Text style={typography.body}>${subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={typography.body}>GST (10%)</Text>
            <Text style={typography.body}>${(subtotal * 0.1).toFixed(2)}</Text>
          </View>
          {parseFloat(discount) > 0 && (
            <View style={styles.totalRow}>
              <Text style={typography.body}>Discount</Text>
              <Text style={[typography.body, { color: colors.danger }]}>-${parseFloat(discount).toFixed(2)}</Text>
            </View>
          )}
          <View style={[styles.divider, { marginVertical: spacing.sm }]} />
          <View style={styles.totalRow}>
            <Text style={typography.h3}>Total</Text>
            <Text style={typography.h3}>${(subtotal + subtotal * 0.1 - (parseFloat(discount) || 0)).toFixed(2)}</Text>
          </View>
        </Card>

        <View style={{ marginTop: spacing.lg }}>
          <Btn title="Create Quote" onPress={handleSave} loading={loading} />
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  content: { padding: spacing.lg },
  lineItemCard: { marginBottom: spacing.sm },
  lineItemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  removeText: { fontSize: 13, fontWeight: '600', color: colors.danger },
  row: { flexDirection: 'row' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  divider: { height: 1, backgroundColor: colors.gray200 },
});
