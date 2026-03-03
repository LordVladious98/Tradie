import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as SecureStore from 'expo-secure-store';
import { colors } from '../theme';
import {
  LoginScreen, RegisterScreen,
  DashboardScreen,
  CustomerListScreen, CustomerDetailScreen, CustomerFormScreen,
  JobListScreen, JobDetailScreen, JobFormScreen, AddNoteScreen,
  InvoiceListScreen, InvoiceDetailScreen, MarkPaidScreen,
  SettingsScreen,
} from '../screens';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: colors.white },
  headerTintColor: colors.gray900,
  headerShadowVisible: false,
  headerBackTitleVisible: false,
};

// Customers stack
function CustomersStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="CustomerList" component={CustomerListScreen} options={{ title: 'Customers' }} />
      <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} options={{ title: 'Customer' }} />
      <Stack.Screen name="CustomerForm" component={CustomerFormScreen} options={({ route }: any) => ({ title: route.params?.customer ? 'Edit Customer' : 'New Customer' })} />
    </Stack.Navigator>
  );
}

// Jobs stack
function JobsStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="JobList" component={JobListScreen} options={{ title: 'Jobs' }} />
      <Stack.Screen name="JobDetail" component={JobDetailScreen} options={{ title: 'Job Details' }} />
      <Stack.Screen name="JobForm" component={JobFormScreen} options={({ route }: any) => ({ title: route.params?.job ? 'Edit Job' : 'New Job' })} />
      <Stack.Screen name="AddNote" component={AddNoteScreen} options={{ title: 'Add Note' }} />
    </Stack.Navigator>
  );
}

// Invoices stack
function InvoicesStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="InvoiceList" component={InvoiceListScreen} options={{ title: 'Invoices' }} />
      <Stack.Screen name="InvoiceDetail" component={InvoiceDetailScreen} options={{ title: 'Invoice' }} />
      <Stack.Screen name="MarkPaid" component={MarkPaidScreen} options={{ title: 'Record Payment' }} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray400,
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.gray200 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: true, ...screenOptions, title: 'Home' }} />
      <Tabs.Screen name="Jobs" component={JobsStack} />
      <Tabs.Screen name="Customers" component={CustomersStack} />
      <Tabs.Screen name="Invoices" component={InvoicesStack} />
      <Tabs.Screen name="Settings" component={SettingsScreen} options={{ headerShown: true, ...screenOptions }} />
    </Tabs.Navigator>
  );
}

export function RootNav() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync('tokens').then((v) => setAuthed(!!v));
  }, []);

  if (authed === null) return null; // splash/loading

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {authed ? (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="Main" component={MainTabs} />
        </>
      )}
    </Stack.Navigator>
  );
}
