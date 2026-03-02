import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LoginScreen, RegisterOwnerScreen, DashboardScreen, JobsScreen, CustomersScreen, InvoicesScreen, SettingsScreen } from '../screens';
import * as SecureStore from 'expo-secure-store';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

function MainTabs() {
  return <Tabs.Navigator>
    <Tabs.Screen name='Dashboard' component={DashboardScreen} />
    <Tabs.Screen name='Jobs' component={JobsScreen} />
    <Tabs.Screen name='Customers' component={CustomersScreen} />
    <Tabs.Screen name='Invoices' component={InvoicesScreen} />
    <Tabs.Screen name='Settings' component={SettingsScreen} />
  </Tabs.Navigator>;
}

export function RootNav() {
  const [authed, setAuthed] = useState(false);
  useEffect(() => { SecureStore.getItemAsync('tokens').then(v => setAuthed(!!v)); }, []);
  return <Stack.Navigator screenOptions={{ headerShown: false }}>
    {authed ? <Stack.Screen name='Main' component={MainTabs} /> : <>
      <Stack.Screen name='Login' component={LoginScreen} />
      <Stack.Screen name='Register' component={RegisterOwnerScreen} />
    </>}
  </Stack.Navigator>;
}
