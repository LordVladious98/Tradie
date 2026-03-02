import React, { useState } from 'react';
import { Alert, Button, FlatList, Text, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import * as SecureStore from 'expo-secure-store';

export function LoginScreen() {
  const [email, setEmail] = useState('owner@demo.com');
  const [password, setPassword] = useState('Password123!');
  return <View style={{padding:16,gap:8}}><Text>Login</Text><TextInput value={email} onChangeText={setEmail} /><TextInput value={password} secureTextEntry onChangeText={setPassword} /><Button title='Login' onPress={async()=>{const r:any=await api.post('/auth/login',{email,password}); await SecureStore.setItemAsync('tokens',JSON.stringify(r.tokens)); Alert.alert('Logged in','Restart app to load tabs');}} /></View>;
}
export function RegisterOwnerScreen() { return <View style={{padding:16}}><Text>Register owner from API docs endpoint.</Text></View>; }
export function DashboardScreen() { const q=useQuery({queryKey:['summary'],queryFn:()=>api.get<any>('/reports/summary')}); return <View style={{padding:16}}><Text>Dashboard</Text><Text>{JSON.stringify(q.data)}</Text></View>; }
export function CustomersScreen() { const q=useQuery({queryKey:['customers'],queryFn:()=>api.get<any[]>('/customers')}); return <FlatList data={q.data||[]} keyExtractor={i=>i.id} renderItem={({item})=><Text>{item.name}</Text>} />; }
export function JobsScreen() { const q=useQuery({queryKey:['jobs'],queryFn:()=>api.get<any[]>('/jobs')}); return <FlatList data={q.data||[]} keyExtractor={i=>i.id} renderItem={({item})=><Text>{item.title} - {item.status}</Text>} />; }
export function InvoicesScreen() { const q=useQuery({queryKey:['invoices'],queryFn:()=>api.get<any[]>('/invoices')}); return <FlatList data={q.data||[]} keyExtractor={i=>i.id} renderItem={({item})=><Text>{item.invoiceNumber} - {item.computedStatus}</Text>} />; }
export function SettingsScreen() { return <View style={{padding:16}}><Button title='Logout' onPress={async()=>{await SecureStore.deleteItemAsync('tokens'); Alert.alert('Logged out','Restart app')}} /></View>; }
