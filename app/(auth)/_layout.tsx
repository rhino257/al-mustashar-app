import Colors from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { TouchableOpacity, View, ActivityIndicator } from 'react-native'; // Import View and ActivityIndicator
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth

// Removed SQLiteProvider and migrateDbIfNeeded imports
// import { SQLiteProvider } from 'expo-sqlite/next';
// import { migrateDbIfNeeded } from '@/utils/Database';
// Removed RevenueCatProvider import
// import { RevenueCatProvider } from '@/providers/RevenueCat';


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
          <Stack.Screen
            name="(modal)/settings"
            options={{
              headerTitle: 'Settings',
              presentation: 'modal',
              headerShadowVisible: false,
              headerStyle: { backgroundColor: Colors.selected },
              headerRight: () => (
                <TouchableOpacity
                  onPress={() => router.dismiss()}
                  style={{ backgroundColor: Colors.greyLight, borderRadius: 20, padding: 4 }}>
                  <Ionicons name="close-outline" size={16} color={Colors.grey} />
                </TouchableOpacity>
              ),
            }}
          />
          <Stack.Screen
            name="(modal)/image/[url]"
            options={{
              headerTitle: '',
              presentation: 'fullScreenModal',
              headerBlurEffect: 'dark',
              headerStyle: { backgroundColor: 'rgba(0,0,0,0.4)' },
              headerTransparent: true,
              headerShadowVisible: false,
              headerLeft: () => (
                <TouchableOpacity
                  onPress={() => router.back()}
                  style={{ borderRadius: 20, padding: 4 }}>
                  <Ionicons name="close-outline" size={28} color={'#fff'} />
                </TouchableOpacity>
              ),
            }}
          />
        </Stack>
    //   </SQLiteProvider>
    // </RevenueCatProvider>
  );
};

export default Layout;
