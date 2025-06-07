import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Text,
} from 'react-native';
import React, { useState, useRef, memo } from 'react';
import Colors from '@/constants/Colors'; // Assuming Colors is defined here

// Props interface
export interface Props {
  onShouldSend: (message: string, use_reranker: boolean) => void; // Modified to include use_reranker
  isSending: boolean; // RE-ADDED THIS PROP
  onStopSending: () => void; // Added prop to handle stopping the sending process
  isLampActive: boolean; // New prop
  onToggleLamp: () => void; // New prop
  displayPopupMessage: (text: string) => void; // Added prop for displaying popup
}

const MessageInput: React.FC<Props> = (props) => {
  const [message, setMessage] = useState('');
  const { bottom } = useSafeAreaInsets(); // If used for keyboard avoiding view padding
  const inputRef = useRef<TextInput>(null);
  // Removed: const [isLampSelected, setIsLampSelected] = useState(false);

  // Handle lamp icon press
  const handleLampPress = () => {
    props.onToggleLamp(); // Call parent's toggle function
    // Display message based on the new state (which will be reflected in props.isLampActive after parent updates)
    if (!props.isLampActive) { // If it's currently false, pressing it will make it true
      props.displayPopupMessage('تم تفعيل وضع التفكير'); // Thinking mode activated
    } else {
      props.displayPopupMessage('تم الغاء وضع التفكير'); // Thinking mode deactivated
    }
  };

  // Handle upload feature unavailable
  const handleUploadFeatureUnavailable = () => {
    props.displayPopupMessage('ميزة التحميل غير متاحة'); // Upload feature unavailable
  };

  // Handle text input change
  const onChangeText = (text: string) => {
    setMessage(text);
  };

  // Handle send button press
  const onSend = () => {
    if (message.trim().length > 0) {
      props.onShouldSend(message.trim(), props.isLampActive); // Pass props.isLampActive
      setMessage('');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0} // Adjust offset as needed
      style={[styles.keyboardAvoidingView, { paddingBottom: bottom }]}
    >
      {/* Popup message View removed, will be rendered by ChatPage */}

      <View style={styles.contentContainer}>
        {/* TextInput component */}
        <TextInput
          ref={inputRef}
          style={[styles.messageInput, { textAlign: 'right' }]} // Added textAlign: 'right'
          placeholder="أسال المستشار..."
          placeholderTextColor={Colors.chatgptText}
          value={message}
          onChangeText={onChangeText}
          multiline={true}
          scrollEnabled={true}
        />

        {/* Icon Row below TextInput */}
        <View style={styles.iconRow}>
          {/* First iconGroup (RTL Left side) - Now contains Plus Icon */}
          <View style={styles.iconGroup}>
            {/* Plus/Add Icon */}
            <TouchableOpacity style={styles.iconButton} onPress={handleUploadFeatureUnavailable}>
              <Ionicons name="add-circle-outline" size={28} color={Colors.chatgptText} />
            </TouchableOpacity>
          </View>

          {/* Second iconGroup (RTL Right side) - Now contains Lamp then Mic/Send */}
          <View style={styles.iconGroup}>
            {/* Lamp Icon */}
            <TouchableOpacity style={styles.iconButton} onPress={handleLampPress}>
              <Ionicons
                name={props.isLampActive ? 'bulb' : 'bulb-outline'}
                size={24}
                color={props.isLampActive ? Colors.chatgptText : Colors.chatgptText} // Or active color
              />
            </TouchableOpacity>

            {/* THIS IS WHERE THE isSending LOGIC GOES */}
            {/* THIS IS WHERE THE isSending LOGIC GOES */}
            {/* THIS IS WHERE THE isSending LOGIC GOES */}
            {/* THIS IS WHERE THE isSending LOGIC GOES */}
            {props.isSending ? (
              // Display when message is being sent (the "stop recording" like icon)
              <TouchableOpacity key="stop-button" style={[styles.iconButton, styles.recordingIndicatorBase]} onPress={props.onStopSending}>
                <Ionicons name="stop-sharp" size={18} color={Colors.black} />
              </TouchableOpacity>
            ) : message.length === 0 ? (
              // Display Mic icon when no message and not sending
              <TouchableOpacity key="mic-button" style={styles.iconButton} onPress={() => props.displayPopupMessage('هذه الخدمة قيد التطوير')}>
                <Ionicons name="mic-outline" size={28} color={Colors.chatgptText} />
              </TouchableOpacity>
            ) : (
              // Display Send icon when there's a message and not sending
              <TouchableOpacity key="send-button" style={styles.iconButton} onPress={onSend}>
                <Ionicons
                  name="send-outline"
                  size={24}
                  color={Colors.chatgptText}
                  style={{ transform: [{ scaleX: -1 }] }} // Left-pointing send
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    width: '100%',
    backgroundColor: Colors.messageInputBackground, // Dark theme background
  },
  contentContainer: {
    flexDirection: 'column', // Stack TextInput above iconRow
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: Colors.messageInputBackground, // Dark theme background
  },
  messageInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120, // Limit height for multiline input
    backgroundColor: 'transparent', // Input background - Removed background
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingTop: 10, // Adjust padding for multiline
    paddingBottom: 10,
    fontSize: 16,
    color: Colors.chatgptText, // Text color
    marginBottom: 8, // Space between input and icon row
    textAlignVertical: 'top', // Align text to top on Android
  },
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'space-between', // Space out the two icon groups
    alignItems: 'center',
    width: '100%',
  },
  iconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // uploadMessagePopup and uploadMessageText styles removed as the View is removed
  recordingIndicatorBase: {
    backgroundColor: Colors.white, // Ensure Colors.white is defined (e.g., '#FFFFFF')
    borderRadius: 20, // Half of iconButton width/height to make it circular
  },
});

export default memo(MessageInput);
