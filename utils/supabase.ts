import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

// Ensure these environment variables are defined in your .env file
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Add explicit checks and better error messages if variables are missing
if (!supabaseUrl) {
  throw new Error("Supabase URL is not defined. Please set EXPO_PUBLIC_SUPABASE_URL in your .env file.");
}
if (!supabaseAnonKey) {
  throw new Error("Supabase Anon Key is not defined. Please set EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file.");
}

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
  auth: {
    storage: ExpoSecureStoreAdapter as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
