import { Stack } from 'expo-router';
import Colors from '@/constants/Colors';

export default function ModalLayout() {
  return (
    <Stack screenOptions={{
      // presentation: 'modal', // Uncomment if you want all screens in this group to be modals
      headerStyle: { backgroundColor: Colors.chatgptBackground },
      headerTintColor: Colors.white,
    }}>
      <Stack.Screen name="mainSettings" options={{ presentation: 'modal', title: 'الإعدادات' }} />
      <Stack.Screen name="settings" options={{ presentation: 'modal', title: 'API Key & Organization' }} />
      {/* Add other modal screens here, e.g., profile, subscription */}
      {/* ... make sure to define placeholder files for them initially ... */}
    </Stack>
  );
}
