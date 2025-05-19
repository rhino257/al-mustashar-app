import React from 'react'; // Ensure React is imported
import Colors from '@/constants/Colors';
import { Text, View, StyleSheet, Image } from 'react-native'; // Added StyleSheet and Image
import * as DropdownMenu from 'zeego/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth

export type Props = {
  title: string; // This title might become the user's name or email
  items: Array<{
    key: string;
    title: string;
    icon: string;
  }>;
  selected?: string;
  onSelect: (key: string) => void;
};

const HeaderDropDown = ({ title, selected, items, onSelect }: Props) => {
  const { user, fullName, avatarText, isLoading } = useAuth(); // Consume AuthContext
  console.log('[HeaderDropDown] Rendering. FullName from context:', fullName, 'AvatarText from context:', avatarText, 'IsLoading:', isLoading, 'User:', user ? user.id : 'No user');


  // Determine the display name
  const displayName = isLoading && !fullName ? 'Loading...' : (fullName || user?.email || 'User');

  if (isLoading && !fullName) {
    // Optionally return a specific loading indicator for the dropdown if desired
    // return <View><Text>Loading user...</Text></View>;
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <View style={styles.triggerContainer}>
          {/* TEMPORARY VISIBLE MARKER */}
          <Text style={{color: 'red', fontSize: 30, backgroundColor: 'yellow'}}>HEADER DROP DOWN HERE!</Text>

          {/* Avatar Display */}
          {avatarText ? (
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarTextLabel}>{avatarText}</Text>
            </View>
          ) : (
            // Fallback if no avatarText (e.g., a default icon or placeholder image)
            // Using a simple View placeholder since default-avatar.png was not found
            // <View style={styles.avatarPlaceholder} /> // Keeping the placeholder style but rendering null
            null // Changed to null to avoid image resolution error
          )}

          {/* User Name/Email Display */}
          <Text style={styles.userNameText}>{displayName}</Text>

          {/* Optional selected item display */}
          {selected && (
            <Text
              style={{ marginLeft: 10, fontSize: 16, fontWeight: '500', color: Colors.greyLight }}>
              {selected} {'>'}
            </Text>
          )}
        </View>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        align="center"
        side="bottom"
        loop={false}
        alignOffset={0}
        avoidCollisions={true}
        collisionPadding={0}
        sideOffset={0}>
        {items.map((item) => (
          <DropdownMenu.Item key={item.key} onSelect={() => onSelect(item.key)}>
            <DropdownMenu.ItemIcon
              ios={{
                name: item.icon,
                pointSize: 18,
              }}
            />
            <DropdownMenu.ItemTitle>{item.title}</DropdownMenu.ItemTitle>
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
};

const styles = StyleSheet.create({
  triggerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userNameText: {
    fontWeight: '500',
    fontSize: 16,
    color: '#FFFFFF', // Example color, adjust as needed
    marginHorizontal: 8, // Space between avatar and name
  },
  avatarContainer: {
    width: 40, // Adjust size as needed
    height: 40,
    borderRadius: 20, // Half of width/height for a circle
    backgroundColor: Colors.primary, // Or some other distinct color
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarTextLabel: {
    color: '#FFFFFF', // Text color for initials
    fontSize: 16, // Adjust size as needed
    fontWeight: 'bold',
  },
  avatarImage: { // Style for a fallback image if you keep one
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: { // Style for a view placeholder
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.grey, // Placeholder color
  },
});

export default HeaderDropDown;
