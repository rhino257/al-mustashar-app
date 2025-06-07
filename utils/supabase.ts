import 'react-native-url-polyfill/auto';
import { createClient, SupportedStorage } from '@supabase/supabase-js';
// AsyncStorage is no longer directly used here for the adapter
// import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExpoSecureStoreAdapter } from './ExpoSecureStoreAdapter'; // Import the new adapter
import { Platform } from 'react-native'; // Platform is already imported, ensure it stays

export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
export const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Supabase URL is not defined. Please set EXPO_PUBLIC_SUPABASE_URL in your .env file.");
}
if (!supabaseAnonKey) {
  throw new Error("Supabase Anon Key is not defined. Please set EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file.");
}

// The old AsyncStorageAdapter is no longer needed here.
// It will be replaced by ExpoSecureStoreAdapter for native platforms.

// The Supabase client will now be initialized within the AuthProvider component
// Apply conditional storage to the global client as well

const globalStorageAdapter = Platform.OS === 'web' ? undefined : ExpoSecureStoreAdapter; // Use ExpoSecureStoreAdapter for native

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
