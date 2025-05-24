import { useFonts } from 'expo-font';
import { Slot, SplashScreen, Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { AuthProvider, useAuth } from '@/contexts/AuthContext'; // Import AuthProvider and useAuth from Supabase context
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { configureReanimatedLogger } from 'react-native-reanimated';
import * as Sentry from "@sentry/react-native"; // Import Sentry
import { StatusBar } from 'expo-status-bar'; // Added StatusBar import

// configureReanimatedLogger({ disableStrict: true }); // Removed as 'disableStrict' is not a valid property

// Initialize Sentry as early as possible
Sentry.init({
  dsn: "https://ddd00021c9376aca8befad513da9ec65@o4509334426681345.ingest.de.sentry.io/4509334432186448", // Your Sentry DSN
  // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
  // We recommend adjusting this value in production.
  tracesSampleRate: 1.0,
  // Session Replay configuration. Note: Specific integration details may vary by Sentry SDK version.
  // integrations: [
  //   Sentry.replayIntegration()
  // ],
  // replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%.
  // replaysOnErrorSampleRate: 1.0 // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
});

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY; // This variable is no longer used and can be removed later

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const InitialLayout = () => {
  const [loaded, error] = useFonts({
    // Commented out SpaceMono font to test Arabic input support
    // SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  // Use Supabase Auth state
  const { session, user, isLoading: isSupabaseAuthLoading, onboardingStatus } = useAuth(); // Added user and onboardingStatus
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
      return; // Wait until Supabase auth state (including initial profile fetch) is determined
    }

    const currentRoute = segments.join('/');
    const inAuthGroup = segments[0] === '(auth)';

    if (session && user) { // User is signed in and user object is available
      if (onboardingStatus && onboardingStatus !== 'completed') {
        // Onboarding is not complete, redirect to onboarding screen
        if (currentRoute !== '(auth)/onboarding') {
          router.replace('/(auth)/onboarding');
        }
      } else if (onboardingStatus === 'completed') {
        // Onboarding is complete
        if (currentRoute === '(auth)/onboarding' || !inAuthGroup) {
          // If on onboarding screen OR outside auth group, redirect to main app
          router.replace('/(auth)/(drawer)/(chat)/new');
        }
        // If already inAuthGroup and not on onboarding, they are likely on a valid authenticated page.
      }
      // If onboardingStatus is null but session & user exist, AuthContext might still be fetching it.
      // isSupabaseAuthLoading should ideally cover this.
    } else if (!session && inAuthGroup) {
      // User is NOT signed in, but is trying to access a route within the '(auth)' group.
      router.replace('/');
    } else if (!session && currentRoute !== '' && currentRoute !== 'login' && currentRoute !== 'index') {
      // User is not signed in and on some other page (e.g. deep link) that isn't the entry or login
      // router.replace('/'); // Optional: redirect to home if on an unknown public path
    }
  }, [isSupabaseAuthLoading, session, user, onboardingStatus, segments, router]);

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
          headerShown: false, // Hide the header for the login screen
          title: '',
          headerTitleStyle: {
            fontFamily: 'mon-sb',
          },
          // Removed headerLeft as the header is now hidden
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
          <StatusBar style="light" backgroundColor="transparent" translucent={true} />
          <InitialLayout />
        </GestureHandlerRootView>
      </AuthProvider>
    // </ClerkProvider>
  );
};

export default RootLayoutNav;
