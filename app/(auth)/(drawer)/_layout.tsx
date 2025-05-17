import { Drawer } from 'expo-router/drawer';
import { DrawerContentScrollView, DrawerItemList, DrawerItem } from '@react-navigation/drawer';
import { Link, useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
Image,
Text,
View,
StyleSheet,
TouchableOpacity,
useWindowDimensions,
TextInput,
Alert,
} from 'react-native';
import Colors from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { FontAwesome6 } from '@expo/vector-icons';
import { DrawerActions } from '@react-navigation/native';
import { useEffect, useState, useRef } from 'react';
import { getChats, renameChat, deleteChatViaFunction, Chat } from '@/utils/Database'; // Import Supabase functions and Chat type
import { useDrawerStatus } from '@react-navigation/drawer';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth
// Removed Chat import from utils/Interfaces
import { Keyboard } from 'react-native';

export const CustomDrawerContent = (props: any & { dimensions: any }) => {
const { bottom, top } = useSafeAreaInsets();
const { dimensions } = props; // Destructure dimensions from props
const isDrawerOpen = useDrawerStatus() === 'open';
const [history, setHistory] = useState<Chat[]>([]); // Use new Chat type
const router = useRouter();
const [showFeatureUnavailableMessage, setShowFeatureUnavailableMessage] = useState(false);
const timerRef = useRef<NodeJS.Timeout | null>(null); // Ref to store the timeout ID
const [activePopupCoords, setActivePopupCoords] = useState<{ y: number; height: number } | null>(null);
const itemRefs = useRef<{ [key: string]: View | null }>({});

const { user, fullName, avatarText, isLoading } = useAuth(); // Consume AuthContext

useEffect(() => {
loadChats();
Keyboard.dismiss();
}, [isDrawerOpen]);

const handleFeatureUnavailable = (coords: { y: number; height: number } | null) => {
  if (!coords) {
    // Optionally, don't show the message at all if coords are missing
    // setShowFeatureUnavailableMessage(false); // Or handle differently
    return; // Exit if no coords
  }

  setActivePopupCoords(coords); // Set the coordinates for the popup

  if (timerRef.current) {
    clearTimeout(timerRef.current);
  }
  setShowFeatureUnavailableMessage(true);
  timerRef.current = setTimeout(() => {
    setShowFeatureUnavailableMessage(false);
    setActivePopupCoords(null); // Reset active popup coords when message hides
  }, 4000);
};


const loadChats = async () => {
// Load chats from Supabase
try {
const result = await getChats(); // Call new getChats, no db argument
setHistory(result);
} catch (error) {
console.error("Failed to load chats:", error);
// Handle error appropriately in UI if needed
}
};

// Implement renameChat function using Supabase
const onRenameChat = (chatId: string) => { // chatId is now string
Alert.prompt('Rename Chat', 'Enter a new name for the chat', async (newName) => {
if (newName) {
const success = await renameChat(chatId, newName); // Call new renameChat
if (success) {
loadChats(); // Refresh the list
Alert.alert('Success', 'Chat renamed.');
} else {
Alert.alert('Error', 'Failed to rename chat.');
}
}
});
};

// Implement deleteChat function using Supabase Edge Function
const onDeleteChat = (chatId: string) => { // chatId is now string
Alert.alert('Delete Chat', 'Are you sure you want to delete this chat?', [
{ text: 'Cancel', style: 'cancel' },
{
text: 'Delete',
onPress: async () => {
const result = await deleteChatViaFunction(chatId); // Call deleteChatViaFunction
if (result.success) {
loadChats(); // Refresh the list
Alert.alert('Success', result.message || 'Chat deleted.');
// If currently viewing the deleted chat, navigate away:
// if (router.params.id === chatId) router.replace('/(auth)/(drawer)/(chat)/new');
} else {
Alert.alert('Error', result.error || 'Failed to delete chat.');
}
},
},
], { cancelable: false }); // Make alert not dismissible by tapping outside
};

// Determine the display name
const displayName = isLoading ? 'Loading...' : (fullName || user?.email || 'User');

const navigateToSettings = () => {
  // Bypassing TypeScript error by casting to any.
  // The route should be recognized by Expo Router at runtime after creating the file and updating _layout.tsx.
  router.push('/(auth)/(modal)/mainSettings' as any); // <--- UPDATED PATH
};

return (
<View style={{ flex: 1, marginTop: top }}>
<View style={{ backgroundColor: Colors.chatgptBackground, paddingBottom: 10 }}>
<View style={styles.searchSection}>
<Ionicons style={styles.searchIcon} name="search" size={20} color={Colors.greyLight} />
<TextInput
style={styles.input}
placeholder="ابحث"
placeholderTextColor="#ffffff"
underlineColorAndroid="transparent"
/>
</View>
</View>

<DrawerContentScrollView
    {...props}
    contentContainerStyle={{ backgroundColor: Colors.chatgptBackground, paddingTop: 0 }}>
    {props.state.routes.map((route: any, index: number) => {
      const { options } = props.descriptors[route.key];
      const label =
        options.drawerLabel !== undefined
          ? options.drawerLabel
          : options.title !== undefined
          ? options.title
          : route.name;

      const isFocused = props.state.index === index;

      // Check if the route name is 'dalle' or 'explore'
      const isFeatureUnavailable = route.name === 'dalle' || route.name === 'explore';

      return (
        <View // This is the wrapper View
          key={route.key}
          ref={(el) => (itemRefs.current[route.key] = el)} // Assign ref to the wrapper View
          style={[
            isFeatureUnavailable && { opacity: 0.5 },
          ]}
        >
          <DrawerItem
            label={() => {
              // If options.drawerLabel is a function, call it (this handles your custom (chat)/new, dalle, explore labels)
              if (typeof options.drawerLabel === 'function') {
                return options.drawerLabel();
              }

              // Fallback for string labels: 'label' variable holds the string.
              // Wrap the string label in a <Text> component.
              // The color will be determined by inactiveTintColor/activeTintColor of the DrawerItem.
              const textColor = isFocused
                ? (isFeatureUnavailable ? Colors.grey : (options.drawerActiveTintColor || Colors.white))
                : (isFeatureUnavailable ? Colors.grey : (options.drawerInactiveTintColor || Colors.white));

              return <Text style={{ color: textColor, fontSize: 16, fontWeight: '600' }}>{label}</Text>;
            }}
            focused={isFocused}
            inactiveTintColor={isFeatureUnavailable ? Colors.grey : Colors.white}
            activeTintColor={isFeatureUnavailable ? Colors.grey : Colors.white}
            activeBackgroundColor="#212121"
            onPress={() => {
              const isCurrentlyPressedFeatureUnavailable = route.name === 'dalle' || route.name === 'explore';

              if (isCurrentlyPressedFeatureUnavailable) {
                const currentItemRef = itemRefs.current[route.key];
                if (currentItemRef) {
                  currentItemRef.measureInWindow((x, y, w, h) => {
                    // Adjust y by subtracting the safe area 'top' because the popup is positioned
                    // inside CustomDrawerContent which is already offset by 'top'.
                    handleFeatureUnavailable({ y: y - top, height: h });
                  });
                } else {
                  handleFeatureUnavailable(null); // No ref, can't measure
                }
              } else {
                if (isFocused) {
                  props.navigation.dispatch(DrawerActions.closeDrawer());
                } else {
                  props.navigation.navigate(route.name, route.params);
                }
              }
            }}
            style={options.drawerItemStyle} // Apply drawerItemStyle here
          />
        </View>
      );
    })}
    {/* Render DrawerItems for history without ContextMenu */}
    <Text style={styles.chatsLabel}>المحادثات</Text>
     {history.map((chat) => (
        <DrawerItem
          key={chat.chat_id}
          label={chat.chat_name}
          onPress={() => router.push(`/(auth)/(drawer)/(chat)/${chat.chat_id}`)}
          inactiveTintColor={Colors.white}
        />
      ))}
  </DrawerContentScrollView>

  {showFeatureUnavailableMessage && activePopupCoords && ( // Also check activePopupCoords is not null
    <View style={{
      position: 'absolute',
      top: activePopupCoords.y + (activePopupCoords.height / 2) - 20, // Adjusted for a slightly taller popup
      left: 30, // Positioned from the left of the drawer
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderRadius: 8,
      padding: 8, // Slightly less padding
      maxWidth: (props.dimensions.width * 0.86 * 0.6), // Max 60% of the drawer's actual width.
      zIndex: 9999,
      // opacity: 1, // Opacity is now controlled by activePopupCoords being non-null with showFeatureUnavailableMessage
    }}>
      <Text style={styles.featureUnavailableText}>
        هذه الميزة قيد التطوير
      </Text>
    </View>
  )}

  {/* Footer Section - Re-arrange to match desired layout */}
  <TouchableOpacity onPress={navigateToSettings} style={styles.footer}>
    {/* Caret Icon - Should be on the left */}
    <Ionicons name="chevron-up-outline" size={24} color={Colors.gray} style={styles.caretIcon} />

    {/* Name Section - In the middle */}
    <View style={styles.nameContainer}>
      <Text style={styles.userNameText} numberOfLines={1} ellipsizeMode="tail">
        {isLoading && !fullName ? 'Loading...' : (fullName || user?.email || 'User')}
      </Text>
    </View>

    {/* Avatar Section - On the right */}
    {avatarText ? (
      <View style={styles.avatarContainer}>
        <Text style={styles.avatarTextLabel}>{avatarText}</Text>
      </View>
    ) : (
      // For initials placeholder:
      <View style={[styles.avatarContainer, styles.avatarPlaceholder]}>
        <Ionicons name="person-circle-outline" size={24} color={Colors.lightGray} />
      </View>
    )}
  </TouchableOpacity>
</View>


);
};

const Layout = () => {
const navigation = useNavigation();
const dimensions = useWindowDimensions();
// Removed useRevenueCat hook call
const router = useRouter();

return (
<Drawer
drawerContent={(props) => <CustomDrawerContent {...props} dimensions={dimensions} />}
screenOptions={{
headerLeft: () => (
<TouchableOpacity
onPress={() => navigation.dispatch(DrawerActions.toggleDrawer)}
style={{ marginLeft: 16 }}>
<FontAwesome6 name="grip-lines" size={20} color="#ffffff" />
</TouchableOpacity>
),
headerStyle: {
backgroundColor: Colors.chatgptBackground,
},
headerTintColor: '#ffffff', // Set header text and icon color to white
headerShadowVisible: false,
drawerActiveBackgroundColor: '#212121', // Set active drawer item background color to hex code
drawerActiveTintColor: '#ffffff', // Set active drawer item text color to white
drawerInactiveTintColor: '#ffffff', // Set inactive drawer item text color to white
overlayColor: 'rgba(0, 0, 0, 0.2)',
drawerItemStyle: { borderRadius: 12 },
// Removed default drawerLabelStyle: { textAlign: 'right' },
drawerPosition: 'right',
drawerStyle: { width: dimensions.width * 0.86, backgroundColor: Colors.chatgptBackground },
}}>
<Drawer.Screen
name="(chat)/new"
getId={() => Math.random().toString()}
options={{
// title: 'المستشار', // Removed title
headerTitle: '',
drawerLabel: () => ( // Custom drawerLabel for RTL
<View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
<View style={[styles.item, { backgroundColor: '#000' }]}>
<Image source={require('@/assets/images/logo.png')} style={styles.btnImage} />
</View>
<Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>المستشار</Text>
</View>
),
drawerIcon: () => null, // Hide default icon
headerLeft: () => (
<Link href={'/(auth)/(drawer)/(chat)/new'} push asChild>
<TouchableOpacity>
<Ionicons
name="create-outline"
size={24}
color="#ffffff"
style={{ marginLeft: 16 }}
/>
</TouchableOpacity>
</Link>
),
headerRight: () => (
<View style={{ flexDirection: 'row', alignItems: 'center' }}>
<Text style={styles.headerTitle}>المستشار</Text>
<TouchableOpacity
onPress={() => navigation.dispatch(DrawerActions.toggleDrawer)}
style={{ marginRight: 16, marginLeft: 10 }}>
<FontAwesome6 name="grip-lines" size={20} color="#ffffff" />
</TouchableOpacity>
</View>
),
}}
/>
<Drawer.Screen
name="(chat)/[id]"
options={{
headerTitle: '',
drawerItemStyle: {
display: 'none',
},
headerLeft: () => (
<Link href={'/(auth)/(drawer)/(chat)/new'} push asChild>
<TouchableOpacity>
<Ionicons
name="create-outline"
size={24}
color="#ffffff"
style={{ marginLeft: 16 }}
/>
</TouchableOpacity>
</Link>
),
headerRight: () => (
<View style={{ flexDirection: 'row', alignItems: 'center' }}>
<Text style={styles.headerTitle}>المستشار</Text>
<TouchableOpacity
onPress={() => navigation.dispatch(DrawerActions.toggleDrawer)}
style={{ marginRight: 16, marginLeft: 10 }}>
<FontAwesome6 name="grip-lines" size={20} color="#ffffff" />
</TouchableOpacity>
</View>
),
}}
/>
<Drawer.Screen
name="dalle"
options={{
// title: 'تحويل الملفات', // Removed title
drawerLabel: () => ( // Custom drawerLabel for RTL
<View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
<View style={[styles.item, { backgroundColor: '#000' }]}>
<Image source={require('@/assets/images/dalle.png')} style={styles.dallEImage} />
</View>
<Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>تحويل الملفات</Text>
</View>
),
drawerIcon: () => null, // Hide default icon
}}
/>
<Drawer.Screen
name="explore"
options={{
// title: 'استكشف المستشار', // Removed title
drawerLabel: () => ( // Custom drawerLabel for RTL
<View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
<View
style={[
styles.item,
{
backgroundColor: Colors.chatgptBackground, // Set Explore GPTs icon background color
width: 28,
height: 28,
alignItems: 'center',
justifyContent: 'center',
},
]}>
<Ionicons name="apps-outline" size={18} color="#000" />
</View>
<Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>استكشف المستشار</Text>
</View>
),
drawerIcon: () => null, // Hide default icon
}}
/>
</Drawer>
);
};

const styles = StyleSheet.create({
searchSection: {
marginHorizontal: 16,
borderRadius: 10,
height: 34,
flexDirection: 'row-reverse',
justifyContent: 'center',
alignItems: 'center',
backgroundColor: Colors.chatgptTextField, // Set search field background color
},
searchIcon: {
padding: 6,
color: '#ffffff', // Set search icon color to white
},
input: {
flex: 1,
paddingTop: 8,
paddingRight: 8,
paddingBottom: 8,
paddingLeft: 0,
alignItems: 'center',
color: '#ffffff', // Set search input text color to white
textAlign: 'right',
},
footer: {
flexDirection: 'row',        // Align children in a row
alignItems: 'center',        // Vertically center items
    paddingVertical: 15,
    paddingHorizontal: 15, // Slightly reduce horizontal padding of the whole footer if needed
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
    backgroundColor: '#222222', // Or your theme's dark color
  },
  caretIcon: { // <<< ADD THIS STYLE DEFINITION
    marginRight: 6, // Space between caret and name
  },
  roundImage: {
    width: 30,
    height: 30,
  },
avatar: { // This style is for the hardcoded image, will be replaced by avatarContainer/avatarPlaceholder
width: 40,
height: 40,
borderRadius: 10,
},
userName: {
fontSize: 16,
fontWeight: '600',
color: '#ffffff', // Set footer username text color to white
},
item: {
borderRadius: 15,
overflow: 'hidden',
},
btnImage: {
margin: 6,
width: 16,
height: 16,
},
dallEImage: {
width: 28,
height: 28,
resizeMode: 'cover',
},
headerTitle: {
fontSize: 20,
fontWeight: 'bold',
color: '#ffffff', // Set header title color to white
textAlign: 'right',
},
chatsLabel: {
fontSize: 16,
fontWeight: 'bold',
color: '#ffffff',
paddingHorizontal: 16,
marginTop: 10,
marginBottom: 5,
},
featureUnavailableText: {
  color: '#ffffff',
  fontSize: 13, // Adjust as desired
  textAlign: 'right', // Ensure proper alignment for Arabic text
},
avatarContainer: { // This will be for the initials 'MO' circle
  width: 36,
  height: 36,
  borderRadius: 18,
  // backgroundColor: Colors.primary, // Previous green background
  backgroundColor: '#555555',     // A neutral dark gray for initials background
  justifyContent: 'center',
  alignItems: 'center',
  marginLeft: 10, // Space between name and avatar
},
avatarTextLabel: {
  color: '#FFFFFF', // Text color for initials
  fontSize: 14,
  fontWeight: 'bold',
},
avatarPlaceholder: { // If using the Ionicons placeholder
  backgroundColor: 'transparent', // Or a very subtle background
},
avatarAndNameContainer: { // This style is no longer needed as a direct child of footer
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1, // Allows name to take available space and truncate
    marginRight: 10, // Space before the caret icon
  },
  nameContainer: {
    flex: 1,
    // marginHorizontal: 2, // REDUCED or REMOVED: Let caret/avatar margins control space
  },
  userNameText: {
    fontSize: 17, // INCREASED: Make name bigger
    color: Colors.white,
    fontWeight: '600', // Slightly bolder if desired with larger size
    // textAlign: 'left', // Default for LTR, will be right for RTL if device is set
  },
});

export default Layout;
