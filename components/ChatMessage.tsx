import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ActivityIndicator, Pressable } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard'; // If used for copy
import { Message } from '@/utils/Database'; // Import your Supabase Message type
import { Ionicons } from '@expo/vector-icons';
import * as ContextMenu from 'zeego/context-menu';
import { Link } from 'expo-router'; // Import Link for image modal navigation
import Colors from '@/constants/Colors'; // Import Colors

// Props now directly use the Message type from Supabase
const ChatMessage = (message: Message & { loading?: boolean }) => { // Add loading prop for streaming indicator
  const isUser = message.is_user_message;

  const onCopy = () => {
    if (message.message_text) {
      Clipboard.setString(message.message_text);
      // Optionally show a toast or feedback
    }
  };

  // Adapt context menu items for image messages
  const contextItems = message.message_type === 'image' && message.file_metadata?.url ? [
    { title: 'Copy Image', systemIcon: 'doc.on.doc', action: () => copyImageToClipboard(message.file_metadata!.url as string) },
    {
      title: 'Save to Photos',
      systemIcon: 'arrow.down.to.line',
      action: () => downloadAndSaveImage(message.file_metadata!.url as string),
    },
    { title: 'Share Image', systemIcon: 'square.and.arrow.up', action: () => shareImage(message.file_metadata!.url as string) },
  ] : []; // Empty array for non-image messages

  // Helper functions for image handling (assuming they exist in utils/Image.ts)
  // Need to import these or define them here if not in utils/Image.ts
  // For now, assuming they exist and are imported/defined elsewhere or will be added.
  const copyImageToClipboard = (url: string) => { console.log('Copy image to clipboard:', url); /* Implement actual logic */ };
  const downloadAndSaveImage = (url: string) => { console.log('Download and save image:', url); /* Implement actual logic */ };
  const shareImage = (url: string) => { console.log('Share image:', url); /* Implement actual logic */ };


  return (
    <View style={[
      styles.row,
      isUser ? styles.userMessageContainer : styles.botMessageContainer,
    ]}>
      {/* User Avatar or Bot Icon */}
      {isUser ? (
         <Image source={{ uri: 'https://galaxies.dev/img/meerkat_2.jpg' }} style={styles.avatar} /> // Assuming a default user avatar
      ) : (
        <View style={[styles.item, { backgroundColor: '#000' }]}>
          <Image source={require('@/assets/images/logo-white.png')} style={styles.btnImage} />
        </View>
      )}


      {message.loading ? ( // Show loading indicator for streaming bot message
        <View style={styles.loading}>
          <ActivityIndicator color={Colors.primary} size="small" />
        </View>
      ) : (
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.botBubble]}>
          {/* Handle text messages */}
          {message.message_type === 'text' || !message.message_type ? ( // Default to text if no type
            <Text style={isUser ? styles.userMessageText : styles.botMessageText}>
              {message.message_text}
            </Text>
          ) : null}

          {/* Handle image messages */}
          {message.message_type === 'image' && message.file_metadata?.url && (
            <ContextMenu.Root> {/* Add ContextMenu for images */}
              <ContextMenu.Trigger>
                <Link
                  href={`/(auth)/(modal)/image/${encodeURIComponent(
                    message.file_metadata.url as string
                  )}?prompt=${encodeURIComponent(message.file_metadata.prompt as string || '')}`} // Pass prompt if available
                  asChild>
                  <Pressable>
                    <Image source={{ uri: message.file_metadata.url as string }} style={styles.image} />
                  </Pressable>
                </Link>
              </ContextMenu.Trigger>
              <ContextMenu.Content>
                {contextItems.map((item, index) => (
                  <ContextMenu.Item key={item.title} onSelect={item.action}>
                    <ContextMenu.ItemTitle>{item.title}</ContextMenu.ItemTitle>{/* Fixed typo */}
                    <ContextMenu.ItemIcon
                      ios={{
                        name: item.systemIcon,
                        pointSize: 18,
                      }}
                    />
                  </ContextMenu.Item>
                ))}
              </ContextMenu.Content>
            </ContextMenu.Root>
          )}

          {/* Display prompt text below image if available */}
          {message.message_type === 'image' && message.file_metadata?.prompt && (
             <Text style={styles.promptText}>Prompt: {message.file_metadata.prompt as string}</Text>
          )}


          {/* Copy button for text messages */}
          {!isUser && (message.message_type === 'text' || !message.message_type) && message.message_text && ( // Show copy for bot text messages
            <TouchableOpacity onPress={onCopy} style={styles.copyButton}>
              <Ionicons name="copy-outline" size={18} color="#777" />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

// Add your existing or updated styles here
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    marginVertical: 5,
    alignItems: 'flex-start', // Align items to the top
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
    marginLeft: 50, // Add margin to the left for user messages
  },
  botMessageContainer: {
    justifyContent: 'flex-start',
    marginRight: 50, // Add margin to the right for bot messages
  },
  bubble: {
    padding: 10,
    borderRadius: 15,
    maxWidth: '80%',
  },
  userBubble: {
    backgroundColor: '#007AFF', // Example user bubble color
    alignSelf: 'flex-end',
  },
  botBubble: {
    backgroundColor: '#E5E5EA', // Example bot bubble color
    alignSelf: 'flex-start',
  },
  userMessageText: {
    color: '#fff',
  },
  botMessageText: {
    color: '#000',
  },
  image: {
    width: 200,
    height: 200,
    borderRadius: 10,
    marginVertical: 5,
  },
  promptText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#555', // Adjust color as needed
    marginTop: 4,
  },
  copyButton: {
    marginTop: 8,
    alignSelf: 'flex-end', // Or position as preferred
  },
  item: {
    borderRadius: 15,
    overflow: 'hidden',
    width: 30, // Match avatar size
    height: 30, // Match avatar size
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnImage: {
    margin: 6,
    width: 16,
    height: 16,
  },
   avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#000',
  },
  loading: {
    justifyContent: 'center',
    height: 26,
    marginLeft: 14,
  },
});

export default ChatMessage;
