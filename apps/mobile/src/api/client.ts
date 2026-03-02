import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { ApiClient, configureTokenStore, Tokens } from '@tradieflow/shared';

configureTokenStore({
  getTokens: async () => {
    const raw = await SecureStore.getItemAsync('tokens');
    return raw ? (JSON.parse(raw) as Tokens) : null;
  },
  setTokens: async (tokens) => {
    if (!tokens) return SecureStore.deleteItemAsync('tokens');
    await SecureStore.setItemAsync('tokens', JSON.stringify(tokens));
  }
});

export const api = new ApiClient({ baseUrl: Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3001' });
