import 'react-native-url-polyfill/auto';
import { createClient, SupportedStorage } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
export const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Supabase URL is not defined. Please set EXPO_PUBLIC_SUPABASE_URL in your .env file.");
}
if (!supabaseAnonKey) {
  throw new Error("Supabase Anon Key is not defined. Please set EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file.");
}

// Create a simple AsyncStorage adapter
// Add a check to ensure storage operations only happen in a client-side environment
export const AsyncStorageAdapter: SupportedStorage = {
  getItem: async (key: string) => {
    if (typeof window === 'undefined' && typeof document === 'undefined') {
      // Not in a browser-like environment, return null or handle appropriately
      console.warn('AsyncStorage.getItem called in non-client environment');
      return null;
    }
    return AsyncStorage.getItem(key);
  },
  setItem: async (key: string, value: string) => {
    if (typeof window === 'undefined' && typeof document === 'undefined') {
      console.warn('AsyncStorage.setItem called in non-client environment');
      return;
    }
    return AsyncStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    if (typeof window === 'undefined' && typeof document === 'undefined') {
      console.warn('AsyncStorage.removeItem called in non-client environment');
      return;
    }
    return AsyncStorage.removeItem(key);
  },
};

// The Supabase client will now be initialized within the AuthProvider component
// Apply conditional storage to the global client as well
import { Platform } from 'react-native'; // Import Platform

const globalStorageAdapter = Platform.OS === 'web' ? undefined : AsyncStorageAdapter;

export const supabase = createClient(
  supabaseUrl!,
  supabaseAnonKey!,
  {
    auth: {
      storage: globalStorageAdapter as SupportedStorage, // Use conditional adapter
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
