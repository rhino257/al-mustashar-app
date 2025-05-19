import Colors from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import * as Sentry from 'sentry-expo'; // Import Sentry
import { TouchableOpacity, View, ActivityIndicator } from 'react-native'; // Import View and ActivityIndicator
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth

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
  const { session, isLoading } = useAuth(); // Use useAuth hook

  // If session is loading or null, don't render authenticated content
  if (isLoading || !session) {
    // You could return a loading indicator here if needed,
    // but returning null allows the root layout to handle the redirect without rendering this content.
    return null;
  }

  return (
    // Removed RevenueCatProvider and SQLiteProvider
    // <RevenueCatProvider>
    //   <SQLiteProvider databaseName="chat.db" onInit={migrateDbIfNeeded}>
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: Colors.selected },
          }}>
          <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
          {/* Include the entire (modal) group and set its presentation to modal */}
          <Stack.Screen name="(modal)" options={{ headerShown: false, presentation: 'modal' }} />
        </Stack>
    //   </SQLiteProvider>
    // </RevenueCatProvider>
  );
};

export default Layout;
