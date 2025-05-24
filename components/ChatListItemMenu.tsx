import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors'; // Assuming you have a Colors constant file

interface ChatListItemMenuProps {
  isVisible: boolean;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
  position?: { x: number; y: number }; // Optional: for precise positioning if needed
  // If not using absolute positioning based on touch, use standard modal presentation
}

const ChatListItemMenu: React.FC<ChatListItemMenuProps> = ({
  isVisible,
  onClose,
  onRename,
  onDelete,
  position, // This might be tricky with standard Modals, often they center or slide up
}) => {
  // For simplicity, this example uses a standard centered modal.
  // For a popover effect at `position`, a more complex implementation or a library might be needed.

  return (
    <Modal
      transparent={true}
      visible={isVisible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={[styles.menuContainer]}>
          {/* Prevent clicks inside the menu from closing it */}
          <Pressable onPress={() => {}}> 
            <TouchableOpacity style={styles.menuItem} onPress={onRename}>
              <Ionicons name="pencil-outline" size={20} color={Colors.white} style={styles.icon} />
              <Text style={styles.menuItemText}>إعادة تسمية</Text>
            </TouchableOpacity>
            <View style={styles.separator} />
            <TouchableOpacity style={styles.menuItem} onPress={onDelete}>
              <Ionicons name="trash-outline" size={20} color={Colors.danger} style={styles.icon} />
              <Text style={[styles.menuItemText, { color: Colors.white }]}>حذف</Text>
            </TouchableOpacity>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center', // Center for this example
    alignItems: 'center',     // Center for this example
  },
  menuContainer: {
    backgroundColor: Colors.chatgptBackground, // Match drawer background
    borderRadius: 8,
    paddingVertical: 5,
    minWidth: 200,
    maxWidth: 280,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  icon: {
    marginRight: 10,
  },
  menuItemText: {
    fontSize: 16,
    color: Colors.white, // White text
    textAlign: 'right', // For RTL text
    flex: 1, // Ensure text takes available space for alignment
  },
  separator: {
    height: 1,
    backgroundColor: Colors.chatgptGray, // Darker separator for dark theme
    marginHorizontal: 10,
  }
});

export default ChatListItemMenu;
