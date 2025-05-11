import { useFonts } from 'expo-font';
import { Slot, SplashScreen, Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { AuthProvider, useAuth } from '@/contexts/AuthContext'; // Import AuthProvider and useAuth from Supabase context
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY; // This variable is no longer used and can be removed later

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const InitialLayout = () => {
  const [loaded, error] = useFonts({
    // Commented out SpaceMono font to test Arabic input support
    // SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  // Use Supabase Auth state
  const { session, isLoading: isSupabaseAuthLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  // Note: With no fonts loaded, 'loaded' will be true immediately.
  // If you add other fonts later, ensure this effect correctly handles their loading state.

  // Redirection logic based on Supabase Auth state
  useEffect(() => {
    if (isSupabaseAuthLoading) {
      return; // Wait until Supabase auth state is determined
    }

    const inAuthGroup = segments[0] === '(auth)';

    if (session && !inAuthGroup) {
      // User is signed in with Supabase and is currently outside the '(auth)' group of routes.
      // Redirect them to the main authenticated part of the app.
      router.replace('/(auth)/(drawer)/(chat)/new'); // Or your default authenticated route
    } else if (!session && inAuthGroup) {
      // User is NOT signed in with Supabase, but is trying to access a route within the '(auth)' group.
      // Redirect them to the initial screen (which should lead to login).
      router.replace('/');
    }
    // Optional: Add more specific conditions if needed, for example,
    // if a non-logged-in user tries to access a specific deep path that isn't '/login'.
    // else if (!session && segments.join('/') !== '' && segments.join('/') !== 'login') {
    //   router.replace('/');
    // }

  }, [isSupabaseAuthLoading, session, segments, router]);

  // Render Slot only when fonts and auth state are loaded
  if (!loaded || isSupabaseAuthLoading) {
     return <Slot />;
  }


  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="login"
        options={{
          presentation: 'modal',
          title: '',
          headerTitleStyle: {
            fontFamily: 'mon-sb',
          },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="close-outline" size={28} />
            </TouchableOpacity>
          ),
        }}
      />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
    </Stack>
  );
};

const RootLayoutNav = () => {
  return (
    // Remove ClerkProvider
    // <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY!} tokenCache={tokenCache}>
      <AuthProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <InitialLayout />
        </GestureHandlerRootView>
      </AuthProvider>
    // </ClerkProvider>
  );
};

export default RootLayoutNav;
