import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RootNav } from './src/navigation';

const client = new QueryClient();

export default function App() {
  return <QueryClientProvider client={client}><NavigationContainer><RootNav /></NavigationContainer></QueryClientProvider>;
}
