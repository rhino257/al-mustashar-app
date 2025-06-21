import React from 'react';
import Colors from '@/constants/Colors';
import { Text, View, StyleSheet } from 'react-native';
import * as DropdownMenu from 'zeego/dropdown-menu';
import { Ionicons } from '@expo/vector-icons'; // Added for chevron icon

export type ChatModeDropDownItem = {
  key: string;
  title: string;
  // Icon is removed from item type as per preference
};

export type Props = {
  items: Array<ChatModeDropDownItem>;
  selectedModeKey: string; // Key of the selected mode
  onSelect: (key: string) => void;
};

const ChatModeDropDown = ({ items, selectedModeKey, onSelect }: Props) => {
  const selectedItem = items.find(item => item.key === selectedModeKey);
  const displayTitle = selectedItem ? selectedItem.title : 'Select Mode';

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <View style={styles.triggerContainer}>
          <Text style={styles.modeTitleText}>{displayTitle}</Text>
          <Ionicons name="chevron-down" size={20} color={Colors.white} style={styles.chevronIcon} />
        </View>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        align="start" // Changed from "center" to "start"
        side="bottom"
        loop={false}
        alignOffset={0}
        avoidCollisions={true}
        collisionPadding={10} // Added some padding
        sideOffset={5} // Added some offset
        style={styles.dropdownContent} // Style for the content area
      >
        {items.map((item) => (
          <DropdownMenu.Item key={item.key} onSelect={() => onSelect(item.key)} style={styles.dropdownItem}>
            {/* Icon is removed from here */}
            <DropdownMenu.ItemTitle style={styles.dropdownItemTitle}>{item.title}</DropdownMenu.ItemTitle>
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
    backgroundColor: Colors.chatgptTextField, // Button-like background
    paddingHorizontal: 12, // Adjusted horizontal padding
    paddingVertical: 10,
    borderRadius: 12, // More rounded edges
    alignSelf: 'center', // Allow the container to shrink to content size
    // Subtle shadow for a "glowing" effect
    elevation: 5, // For Android
    shadowColor: Colors.white, // For iOS - a light glow
    shadowOffset: { width: 0, height: 0 }, // For iOS
    shadowOpacity: 0.3, // For iOS
    shadowRadius: 4, // For iOS
  },
  modeTitleText: {
    fontWeight: '600', // Bolder
    fontSize: 17,    // Slightly larger
    color: Colors.white,
  },
  chevronIcon: {
    marginLeft: 8,
  },
  dropdownContent: {
    backgroundColor: Colors.chatgptBackground,
    borderRadius: 12, // Maintains rounded corners
    flex: 0,          // Prevents growing/shrinking, sizes to content
    alignSelf: 'flex-start', // Aligns based on content width
    // paddingHorizontal: 0, // Removed as per new suggestion, flexbox should handle
  },
  dropdownItem: {
    paddingHorizontal: 16,   // Padding around item content
    paddingVertical: 10,
    flex: 0,          // Ensures item sizes to its content
    alignSelf: 'flex-start', // Prevents stretching to container width
  },
  dropdownItemTitle: {
    color: Colors.white, // Ensure text is white
    fontSize: 16,
    textAlign: 'center', // Center align text in dropdown items
  },
});

export default ChatModeDropDown;
