import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import Colors from '@/constants/Colors';

interface RenameChatModalProps {
  isVisible: boolean;
  currentName: string;
  onSave: (newName: string) => void;
  onCancel: () => void;
}

const RenameChatModal: React.FC<RenameChatModalProps> = ({
  isVisible,
  currentName,
  onSave,
  onCancel,
}) => {
  const [newName, setNewName] = useState(currentName);

  useEffect(() => {
    if (isVisible) {
      setNewName(currentName); // Reset text input when modal becomes visible
    }
  }, [isVisible, currentName]);

  const handleSave = () => {
    if (newName.trim()) {
      onSave(newName.trim());
    }
  };

  return (
    <Modal
      transparent={true}
      visible={isVisible}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <Pressable style={styles.overlayPressable} onPress={onCancel}>
          <Pressable style={styles.modalContainer} onPress={() => {}}>
            <Text style={styles.title}>Rename Chat</Text>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="Enter new chat name"
              placeholderTextColor={Colors.greyLight}
              autoFocus={true}
            />
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onCancel}>
                <Text style={[styles.buttonText, styles.cancelButtonText]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={handleSave}>
                <Text style={styles.buttonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayPressable: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%', // Ensure Pressable covers the whole screen
  },
  modalContainer: {
    backgroundColor: Colors.chatgptBackground, // Match drawer background
    borderRadius: 8,
    padding: 20,
    width: '85%',
    maxWidth: 350,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: Colors.white, // White text
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.grey, // Darker border for dark theme
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
    marginBottom: 20,
    color: Colors.white, // White text for input
    textAlign: 'right', // For RTL placeholder/input
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    marginLeft: 10,
  },
  saveButton: {
    backgroundColor: Colors.primary,
  },
  cancelButton: {
    backgroundColor: Colors.chatgptGray, // Darker cancel button
  },
  buttonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '500',
  },
  cancelButtonText: {
    color: Colors.white, // White text for cancel button
  }
});

export default RenameChatModal;
