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
  onShouldSend: (message: string) => void;
  isSending: boolean; // RE-ADDED THIS PROP
  onStopSending: () => void; // Added prop to handle stopping the sending process
}

const MessageInput: React.FC<Props> = (props) => {
  const [message, setMessage] = useState('');
  const { bottom } = useSafeAreaInsets(); // If used for keyboard avoiding view padding
  const inputRef = useRef<TextInput>(null);
  const [showUploadMessage, setShowUploadMessage] = useState(false); // For popup messages
  const [uploadMessageText, setUploadMessageText] = useState(''); // For popup messages
  const timerRef = useRef<NodeJS.Timeout | null>(null); // For popup messages
  const [isLampSelected, setIsLampSelected] = useState(false); // For the lamp icon

  // Helper function to display popup messages
  const displayMessage = (text: string) => {
    setUploadMessageText(text);
    setShowUploadMessage(true);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      setShowUploadMessage(false);
    }, 2000); // Hide after 2 seconds
  };

  // Handle lamp icon press
  const handleLampPress = () => {
    setIsLampSelected(!isLampSelected);
    // TODO: Implement lamp functionality
    displayMessage('Lamp feature unavailable');
  };

  // Handle upload feature unavailable
  const handleUploadFeatureUnavailable = () => {
    displayMessage('Upload feature unavailable');
  };

  // Handle text input change
  const onChangeText = (text: string) => {
    setMessage(text);
  };

  // Handle send button press
  const onSend = () => {
    if (message.trim().length > 0) {
      props.onShouldSend(message.trim());
      setMessage('');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0} // Adjust offset as needed
      style={[styles.keyboardAvoidingView, { paddingBottom: bottom }]}
    >
      {/* Popup message View */}
      {showUploadMessage && (
        <View style={styles.uploadMessagePopup}>
          <Text style={styles.uploadMessageText}>{uploadMessageText}</Text>
        </View>
      )}

      <View style={styles.contentContainer}>
        {/* TextInput component */}
        <TextInput
          ref={inputRef}
          style={styles.messageInput}
          placeholder="Message"
          placeholderTextColor={Colors.chatgptText}
          value={message}
          onChangeText={onChangeText}
          multiline={true}
          scrollEnabled={true}
        />

        {/* Icon Row below TextInput */}
        <View style={styles.iconRow}>
          {/* First iconGroup (RTL Left side) */}
          <View style={styles.iconGroup}>
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
              <TouchableOpacity key="mic-button" style={styles.iconButton} onPress={() => {/* TODO: Voice input */}}>
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

            {/* Lamp Icon (remains next to the block above) */}
            <TouchableOpacity style={styles.iconButton} onPress={handleLampPress}>
              <Ionicons
                name={isLampSelected ? 'bulb' : 'bulb-outline'}
                size={24}
                color={isLampSelected ? Colors.chatgptText : Colors.chatgptText} // Or active color
              />
            </TouchableOpacity>
          </View>

          {/* Second iconGroup (RTL Right side) */}
          <View style={styles.iconGroup}>
            {/* Plus/Add Icon */}
            <TouchableOpacity style={styles.iconButton} onPress={handleUploadFeatureUnavailable}>
              <Ionicons name="add-circle-outline" size={28} color={Colors.chatgptText} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    width: '100%',
    backgroundColor: Colors.chatgptDarkGray, // Dark theme background
  },
  contentContainer: {
    flexDirection: 'column', // Stack TextInput above iconRow
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: Colors.chatgptDarkGray, // Dark theme background
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
  uploadMessagePopup: {
    position: 'absolute',
    top: -40, // Position above the input
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 5,
    padding: 8,
    alignItems: 'center',
    zIndex: 10, // Ensure it's above other elements
  },
  uploadMessageText: {
    color: Colors.white,
    fontSize: 14,
  },
  recordingIndicatorBase: {
    backgroundColor: Colors.white, // Ensure Colors.white is defined (e.g., '#FFFFFF')
    borderRadius: 20, // Half of iconButton width/height to make it circular
  },
});

export default memo(MessageInput);
