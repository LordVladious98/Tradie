import React from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Card, LoadingView, Btn } from '../components';
import { colors, spacing, typography } from '../theme';

const PLANS = [
  { id: 'FREE', name: 'Free', price: '$0/mo', features: ['5 jobs', '2 invoices/mo', '1 user'] },
  { id: 'STARTER', name: 'Starter', price: '$29/mo', features: ['Unlimited jobs', '50 invoices/mo', '3 users', 'Email sending'] },
  { id: 'PRO', name: 'Pro', price: '$59/mo', features: ['Unlimited everything', 'Priority support', 'Custom branding', 'API access'] },
];

export function SubscriptionScreen({ navigation }: any) {
  const qc = useQueryClient();
  const { data: sub, isLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.get<any>('/subscription'),
  });

  const checkoutMutation = useMutation({
    mutationFn: (plan: string) => api.post<any>('/subscription/create-checkout', { plan }),
    onSuccess: (data) => {
      // Open the checkout URL in the browser — payment happens on the web,
      // not in-app. This is the legitimate way to bypass Apple's 30% IAP
      // commission for B2B SaaS apps.
      if (data.url) Linking.openURL(data.url);
    },
    onError: (e: any) => Alert.alert('Error', e?.message || 'Could not start checkout'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.post('/subscription/cancel'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subscription'] }); Alert.alert('Cancelled', 'Your subscription will end at the current billing period.'); },
  });

  if (isLoading) return <LoadingView />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={typography.h1}>Subscription</Text>

      {sub && (
        <Card style={{ marginTop: spacing.lg }}>
          <View style={styles.row}>
            <Text style={typography.label}>CURRENT PLAN</Text>
            <Text style={[typography.h3, { color: colors.primary }]}>{sub.plan}</Text>
          </View>
          <View style={[styles.row, { marginTop: spacing.sm }]}>
            <Text style={typography.bodySmall}>Status</Text>
            <Text style={[typography.body, { color: sub.isActive ? colors.success : colors.danger }]}>
              {sub.status === 'TRIALING' ? 'Trial' : sub.status}
            </Text>
          </View>
          {sub.trialEndsAt && sub.status === 'TRIALING' && (
            <Text style={[typography.bodySmall, { marginTop: spacing.xs }]}>
              Trial ends: {new Date(sub.trialEndsAt).toLocaleDateString()}
            </Text>
          )}
          {sub.currentPeriodEnd && sub.status === 'ACTIVE' && (
            <Text style={[typography.bodySmall, { marginTop: spacing.xs }]}>
              Next billing: {new Date(sub.currentPeriodEnd).toLocaleDateString()}
            </Text>
          )}
          {sub.cancelAtPeriodEnd && (
            <Text style={[typography.bodySmall, { marginTop: spacing.xs, color: colors.danger }]}>
              Will cancel at end of billing period
            </Text>
          )}
        </Card>
      )}

      <Text style={[typography.label, { marginTop: spacing.xl, marginBottom: spacing.sm }]}>PLANS</Text>

      {PLANS.map((plan) => (
        <Card key={plan.id} style={[styles.planCard, sub?.plan === plan.id && styles.planCardActive]}>
          <View style={styles.row}>
            <Text style={typography.h3}>{plan.name}</Text>
            <Text style={[typography.h3, { color: colors.primary }]}>{plan.price}</Text>
          </View>
          {plan.features.map((f, i) => (
            <Text key={i} style={[typography.bodySmall, { marginTop: 2 }]}>- {f}</Text>
          ))}
          {sub?.plan !== plan.id && plan.id !== 'FREE' && (
            <View style={{ marginTop: spacing.sm }}>
              <Btn
                title={`Upgrade to ${plan.name}`}
                size="sm"
                onPress={() => checkoutMutation.mutate(plan.id)}
                loading={checkoutMutation.isPending}
              />
            </View>
          )}
          {sub?.plan === plan.id && <Text style={[typography.bodySmall, { marginTop: spacing.sm, color: colors.primary, fontWeight: '600' }]}>Current Plan</Text>}
        </Card>
      ))}

      {sub?.status === 'ACTIVE' && !sub.cancelAtPeriodEnd && (
        <View style={{ marginTop: spacing.xl }}>
          <Btn
            title="Cancel Subscription"
            variant="danger"
            onPress={() => Alert.alert('Cancel', 'Are you sure? You will lose access at the end of your billing period.', [
              { text: 'Keep', style: 'cancel' },
              { text: 'Cancel', style: 'destructive', onPress: () => cancelMutation.mutate() },
            ])}
          />
        </View>
      )}

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  content: { padding: spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planCard: { marginBottom: spacing.sm },
  planCardActive: { borderWidth: 2, borderColor: colors.primary },
});
