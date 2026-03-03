import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../api/client';
import * as SecureStore from 'expo-secure-store';
import { Btn, FormField } from '../components';
import { colors, spacing, typography } from '../theme';

export function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert('Error', 'Please enter email and password');
    setLoading(true);
    try {
      const r: any = await api.post('/auth/login', { email, password });
      await SecureStore.setItemAsync('tokens', JSON.stringify(r.tokens));
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (e: any) {
      Alert.alert('Login failed', e?.error?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.logo}>TradieFlow</Text>
          <Text style={styles.subtitle}>Manage your trade business</Text>
        </View>
        <View style={styles.form}>
          <FormField label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
          <FormField label="Password" value={password} onChangeText={setPassword} placeholder="Enter password" secureTextEntry />
          <Btn title="Sign In" onPress={handleLogin} loading={loading} />
        </View>
        <Btn title="Create Account" onPress={() => navigation.navigate('Register')} variant="ghost" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function RegisterScreen({ navigation }: any) {
  const [form, setForm] = useState({ businessName: '', name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const update = (key: string) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

  const handleRegister = async () => {
    if (!form.businessName || !form.name || !form.email || !form.password) {
      return Alert.alert('Error', 'Please fill in all fields');
    }
    if (form.password.length < 8) return Alert.alert('Error', 'Password must be at least 8 characters');
    setLoading(true);
    try {
      const r: any = await api.post('/auth/register-owner', form);
      await SecureStore.setItemAsync('tokens', JSON.stringify(r.tokens));
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (e: any) {
      Alert.alert('Registration failed', e?.error?.message || 'Could not create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.logo}>TradieFlow</Text>
          <Text style={styles.subtitle}>Create your account</Text>
        </View>
        <View style={styles.form}>
          <FormField label="Business Name" value={form.businessName} onChangeText={update('businessName')} placeholder="e.g. Smith Plumbing Pty Ltd" />
          <FormField label="Your Name" value={form.name} onChangeText={update('name')} placeholder="Full name" />
          <FormField label="Email" value={form.email} onChangeText={update('email')} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
          <FormField label="Password" value={form.password} onChangeText={update('password')} placeholder="Min. 8 characters" secureTextEntry />
          <Btn title="Create Account" onPress={handleRegister} loading={loading} />
        </View>
        <Btn title="Already have an account? Sign In" onPress={() => navigation.goBack()} variant="ghost" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  header: { alignItems: 'center', marginBottom: spacing.xxl },
  logo: { fontSize: 36, fontWeight: '800', color: colors.primary, letterSpacing: -1 },
  subtitle: { ...typography.body, marginTop: spacing.xs },
  form: { marginBottom: spacing.lg },
});
