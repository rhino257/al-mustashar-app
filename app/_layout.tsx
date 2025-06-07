import { useFonts } from 'expo-font';
import { SplashScreen, Stack, useRouter, useSegments } from 'expo-router'; // Removed Slot
import LoadingScreen from '@/components/LoadingScreen'; // Added LoadingScreen import
import { useEffect, useState } from 'react'; // Make sure useState is imported
import * as SecureStore from 'expo-secure-store';
import { AuthProvider, useAuth } from '@/contexts/AuthContext'; // Import AuthProvider and useAuth from Supabase context
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, TouchableOpacity, View, I18nManager } from 'react-native'; // Added I18nManager
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'; // Add this import
import { configureReanimatedLogger } from 'react-native-reanimated';
import * as Sentry from "@sentry/react-native"; // Import Sentry
import { StatusBar } from 'expo-status-bar'; // Added StatusBar import
import * as Updates from 'expo-updates'; // Added Updates

// Force RTL layout
I18nManager.forceRTL(true);
I18nManager.allowRTL(true);

// Reload the app if the RTL setting has changed
if (I18nManager.isRTL !== true) {
  Updates.reloadAsync();
}

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

  // NEW: Add a local readiness state for the layout itself
  const [isLayoutReady, setIsLayoutReady] = useState(false);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  useEffect(() => {
    // This effect ensures that we only mark the layout as "ready" after
    // font loading is done AND the initial Supabase auth loading is done.
    // It gives a brief moment for the component tree to stabilize.
    if (loaded && !isSupabaseAuthLoading) {
      const timer = setTimeout(() => {
        setIsLayoutReady(true);
        // console.log('[AppLayout] Layout marked as ready.'); // Diagnostic
      }, 100); // Small delay, e.g., 50-100ms. Adjust if needed.
      return () => clearTimeout(timer);
    } else {
      setIsLayoutReady(false); // Reset if dependencies change
    }
  }, [loaded, isSupabaseAuthLoading]);

  // Redirection logic based on Supabase Auth state AND layout readiness
  useEffect(() => {
    // console.log('[AppLayout] Redirection useEffect triggered. States:', { loaded, isSupabaseAuthLoading, isLayoutReady, sessionExists: !!session, userExists: !!user, onboardingStatus }); // Diagnostic
    
    // Wait for font loading, Supabase auth, AND local layout readiness
    if (!loaded || isSupabaseAuthLoading || !isLayoutReady) {
      // console.log('[AppLayout] Conditions for navigation not met, returning.'); // Diagnostic
      return;
    }

    const currentRoute = segments.join('/');
    const inAuthGroup = segments[0] === '(auth)';
    // console.log('[AppLayout] Current route for redirection check:', currentRoute); // Diagnostic

    if (session && user) { // User is signed in and user object is available
      // console.log('[AppLayout] User is signed in. Onboarding status:', onboardingStatus); // Diagnostic
      if (onboardingStatus && onboardingStatus !== 'completed') {
        // Onboarding is not complete, redirect to onboarding screen
        if (currentRoute !== '(auth)/onboarding') {
          // console.log('[AppLayout] Redirecting to /onboarding. Current route:', currentRoute); // Diagnostic
          router.replace('/(auth)/onboarding');
        }
      } else if (onboardingStatus === 'completed') {
        // Onboarding is complete
        if (currentRoute === '(auth)/onboarding' || !inAuthGroup || currentRoute === 'index' || currentRoute === 'login' || currentRoute === '') {
          // If on onboarding screen OR outside auth group (or on initial public screens), redirect to main app
          // console.log('[AppLayout] Onboarding complete. Redirecting to /new chat. Current route:', currentRoute); // Diagnostic
          router.replace('/(auth)/(drawer)/(chat)/new');
        }
        // If already inAuthGroup (and not onboarding) they are likely on a valid authenticated page.
      }
      // If onboardingStatus is null but session & user exist, isSupabaseAuthLoading should have covered this.
    } else if (!session && inAuthGroup) {
      // User is NOT signed in, but is trying to access a route within the '(auth)' group.
      // console.log('[AppLayout] No session, but in auth group. Redirecting to /. Current route:', currentRoute); // Diagnostic
      router.replace('/');
    } else if (!session && currentRoute !== '' && currentRoute !== 'login' && currentRoute !== 'index') {
      // User is not signed in and on some other page (e.g. deep link) that isn't the entry or login
      // console.log('[AppLayout] No session, on a public non-entry/login page. Optionally redirecting to /. Current route:', currentRoute); // Diagnostic
      // router.replace('/'); // Optional: redirect to home if on an unknown public path
    }
  }, [loaded, isSupabaseAuthLoading, isLayoutReady, session, user, onboardingStatus, segments, router]);

  // Render LoadingScreen when fonts, auth state, or local layout are not ready
  if (!loaded || isSupabaseAuthLoading || !isLayoutReady) {
    // console.log('[AppLayout] Rendering LoadingScreen.'); // Diagnostic
    return <LoadingScreen />;
  }

  // console.log('[AppLayout] Rendering Stack navigator.'); // Diagnostic
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
          <BottomSheetModalProvider>
            <StatusBar style="light" backgroundColor="transparent" translucent={true} />
            <InitialLayout />
          </BottomSheetModalProvider>
        </GestureHandlerRootView>
      </AuthProvider>
    // </ClerkProvider>
  );
};

export default RootLayoutNav;
