import Colors from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter, useSegments } from 'expo-router'; // Import useSegments
import * as Sentry from 'sentry-expo'; // Import Sentry
import { TouchableOpacity, View, ActivityIndicator } from 'react-native'; // Import View and ActivityIndicator
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth
import { useEffect } from 'react'; // Import useEffect

// Removed SQLiteProvider and migrateDbIfNeeded imports
// import { SQLiteProvider } from 'expo-sqlite/next';
// import { migrateDbIfNeeded } from '@/utils/Database';
// Removed RevenueCatProvider import
// import { RevenueCatProvider } from '@/providers/RevenueCat';


// Initialize Sentry
Sentry.init({
  dsn: "https://ddd00021c9376aca8befad513da9ec65@o4509334426681345.ingest.de.sentry.io/4509334432186448",
  enableNative: false, // Disable Sentry Native SDK
  enableInExpoDevelopment: true, // Set to true to enable Sentry in development
  debug: true, // Set to `true` to natively log errors to the console
});

const Layout = () => {
  const router = useRouter();
  const segments = useSegments(); // To check current route
  const { session, isLoading, onboardingStatus } = useAuth();

  useEffect(() => {
    if (isLoading) {
      return; // Don't do anything while auth state is loading
    }

    const isOnboardingScreen = segments.join('/') === '(auth)/onboarding';

    if (session) {
      // User is logged in
      if (onboardingStatus !== 'completed' && !isOnboardingScreen) {
        // If onboarding is not done and we are NOT already on the onboarding screen, redirect.
        router.replace('/(auth)/onboarding');
      }
    }
    // If no session, the root layout (_layout.tsx) handles redirection to login.
    // This (auth) layout shouldn't render if there's no session.
  }, [isLoading, session, onboardingStatus, segments, router]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.light }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // If there's no session, root layout handles redirect. Returning null here.
  if (!session) {
    return null;
  }

  // If session exists, but onboarding is not complete AND we are not yet on the onboarding screen,
  // show a loading indicator while the useEffect above handles the redirect.
  const isOnboardingScreenCheck = segments.join('/') === '(auth)/onboarding';
  if (onboardingStatus !== 'completed' && !isOnboardingScreenCheck) {
     return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.light }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }
  
  // Render the authenticated stack if:
  // 1. User is logged in (session exists).
  // 2. AND (Onboarding is completed OR we are currently on the onboarding screen).
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: Colors.selected },
      }}>
      <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="(modal)" options={{ headerShown: false, presentation: 'modal' }} />
    </Stack>
  );
};

export default Layout;
