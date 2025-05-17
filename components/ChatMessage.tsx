import React, { useEffect, useState, memo } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ActivityIndicator, Pressable } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard'; // If used for copy
import { Message } from '@/utils/Database'; // Import your Supabase Message type
import { Ionicons } from '@expo/vector-icons';
import * as ContextMenu from 'zeego/context-menu';
import { Link } from 'expo-router'; // Import Link for image modal navigation
import Colors from '@/constants/Colors'; // Import Colors
import { supabase } from '../utils/supabase'; // Import Supabase client

// Define a type for ChatMessage props that omits the 'key' property from Message
type ChatMessageProps = Omit<Message, 'key'> & { loading?: boolean };

// Props now directly use the Message type from Supabase
const ChatMessage = (message: ChatMessageProps) => { // Add loading prop for streaming indicator
  const [feedback, setFeedback] = useState<string | null>(message.user_feedback || null);

  const handleFeedback = async (newFeedbackType: 'liked' | 'disliked') => {
    // Safeguard: Abort if feedback is attempted on a temporary ID
    if (message.message_id.startsWith('temp_')) {
      console.warn(`[ChatMessage] Attempted feedback on temporary message_id: ${message.message_id}. Operation aborted.`);
      // Optionally, provide user feedback like a toast here if desired
      return;
    }

    // Only allow feedback if no feedback has been given yet
    if (feedback !== null) {
      console.log(`[ChatMessage] Feedback already given for message_id: ${message.message_id}. No change.`);
      return; // Exit if feedback is already set
    }

    // If no feedback yet, newFeedbackType is the final state
    const finalFeedbackState = newFeedbackType;

    setFeedback(finalFeedbackState); // Optimistic UI update

    const columnToTarget = message.is_user_message ? 'message_id' : 'ai_message_id';
    const idToUpdateWith = message.is_user_message ? message.message_id : message.ai_message_id;

    if (!idToUpdateWith) {
      console.error(`[ChatMessage] Cannot update feedback: ID to use is missing. is_user_message: ${message.is_user_message}, message_id: ${message.message_id}, ai_message_id: ${message.ai_message_id}`);
      setFeedback(feedback); // Revert to original feedback state before optimistic update
      return;
    }

    console.log(`[ChatMessage] Attempting to update feedback for ${columnToTarget}: ${idToUpdateWith} to ${finalFeedbackState}`);

    try {
      const { error: updateError, data: updatedData } = await supabase
        .from('messages')
        .update({ user_feedback: finalFeedbackState })
        .eq(columnToTarget, idToUpdateWith) // Dynamically set column and value
        .select('message_id, user_feedback, ai_message_id'); // More specific select

      if (updateError) {
        console.error(`[ChatMessage] Failed to update feedback in DB for ${columnToTarget}: ${idToUpdateWith}. Error:`, JSON.stringify(updateError, null, 2));
        setFeedback(null); // Revert optimistic UI update to no feedback state
      } else if (!updatedData || updatedData.length === 0) {
        console.warn(`[ChatMessage] Feedback update for ${columnToTarget}: ${idToUpdateWith} to ${finalFeedbackState} resulted in no returned data (0 rows matched or RLS issue). Assuming update was successful based on no direct error.`);
        // Consider if UI should be reverted if 0 rows matched. For now, keeping optimistic.
      } else {
        // console.log(`[ChatMessage] Feedback successfully set for ${columnToTarget}: ${idToUpdateWith}`, updatedData);
      }
    } catch (e: any) {
      console.error(`[ChatMessage] Exception during feedback update for ${columnToTarget}: ${idToUpdateWith}:`, e.message || e);
      setFeedback(null); // Revert on exception to no feedback state
    }
  };
  // console.log('[ChatMessage] Rendering:', {
  //   isUser: message.is_user_message,
  //   messageId: message.message_id,
  //   messageText: message.message_text, // <<< ADD/ENSURE THIS IS LOGGED
  //   messageTextLength: message.message_text?.length,
  //   loading: message.loading,
  //   messageType: message.messageType
  // });
  const isUser = message.is_user_message;

  const onCopy = () => {
    if (message.message_text) {
      Clipboard.setString(message.message_text);
      // Optionally show a toast or feedback
    }
  };

  // Assuming 'message' is a prop passed to ChatMessage containing the message object
  useEffect(() => {
    // Log only for assistant messages that are being actively streamed or finalized
    if (message.is_user_message === false && message.message_text !== undefined) {
      // Adding a more specific marker if it's the placeholder being updated or a final message
      const renderType = message.message_id.startsWith('temp_') || message.loading === false ? "Render_Update" : "Render_Stream";
      console.log(
        new Date().toISOString(),
        `[RN Log Marker] ChatMessage_${renderType} (ID: ${message.message_id}, TextLength: ${message.message_text?.length || 0})`
      );
    }
  }, [message.message_text, message.message_id, message.is_user_message, message.loading]); // Add all relevant dependencies that trigger re-render


  // Adapt context menu items for image messages
  const contextItems = message.messageType === 'image' && message.file_metadata?.url ? [
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
         null // Removed user avatar
      ) : (
        // Removed bot icon
        null
      )}


      {/* Message Bubble Area */}
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.botBubble]}>
        {/* Handle text messages - RENDER TEXT ALWAYS IF IT EXISTS */}
        {(message.messageType === 'text' || !message.messageType) && (
          <Text style={isUser ? styles.userMessageText : styles.botMessageText}>
            {message.message_text}
            {/* Optionally, show a subtle loading indicator next to streaming text for non-user messages */}
            {!isUser && message.loading && message.message_text && <Text style={styles.streamingIndicator}>▋</Text>}
          </Text>
        )}

        {/* Handle image messages */}
        {message.messageType === 'image' && message.file_metadata?.url && (
          <ContextMenu.Root>
            <ContextMenu.Trigger>
              <Link
                href={`/(auth)/(modal)/image/${encodeURIComponent(
                  message.file_metadata.url as string
                )}?prompt=${encodeURIComponent(message.file_metadata.prompt as string || '')}`}
                asChild>
                <Pressable>
                  <Image source={{ uri: message.file_metadata.url as string }} style={styles.image} />
                </Pressable>
              </Link>
            </ContextMenu.Trigger>
            <ContextMenu.Content
              loop={false}
              alignOffset={4}
              avoidCollisions={true}
              collisionPadding={10}
            >
              {contextItems.map((item) => ( // Removed index as it's not used for key if title is unique
                <ContextMenu.Item key={item.title} onSelect={item.action}>
                  <ContextMenu.ItemTitle>{item.title}</ContextMenu.ItemTitle>
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
        {message.messageType === 'image' && message.file_metadata?.prompt && (
           <Text style={styles.promptText}>Prompt: {message.file_metadata.prompt as string}</Text>
        )}

        {/* Show a general loading indicator if it's a bot message, loading, AND there's NO text yet OR it's not a text message type being loaded */}
        {!isUser && message.loading && (!message.message_text && message.messageType === 'text')}
        {/* The above line is a condition. If you want to show the ActivityIndicator when no text has arrived yet: */}
        {!isUser && message.loading && !message.message_text && (
             <ActivityIndicator color={Colors.primary} size="small" style={styles.initialLoadingSpinner} />
        )}


        {/* Feedback buttons for bot messages - only show if ID is not temporary */}
        {!isUser && !message.loading && message.message_text && !message.message_id.startsWith('temp_') && (
          <View style={styles.feedbackActionsContainer}>
            {/* Copy Button - MOVED HERE as the first item */}
            {/* The condition for copy button specifically for text messages is still relevant if feedback icons might appear for non-text messages later */}
            {(message.messageType === 'text' || !message.messageType) && (
              <TouchableOpacity onPress={onCopy} style={styles.feedbackButton}>
                <Ionicons name="copy-outline" size={18} color="#777" />
              </TouchableOpacity>
            )}

            {/* Show Like button if no feedback OR if feedback is 'liked' */}
            {(feedback === null || feedback === 'liked') && (
              <TouchableOpacity
                style={styles.feedbackButton}
                onPress={() => handleFeedback('liked')}
                disabled={feedback !== null} // Disable if any feedback is given
              >
                <Ionicons
                  name={feedback === 'liked' ? 'thumbs-up' : 'thumbs-up-outline'}
                  size={18}
                  style={[
                    feedback === 'liked' ? styles.likedIcon : styles.neutralIcon,
                    feedback !== null && feedback !== 'liked' ? styles.hiddenIcon : {} // Hide if other feedback given
                  ]}
                />
              </TouchableOpacity>
            )}

            {/* Show Dislike button if no feedback OR if feedback is 'disliked' */}
            {(feedback === null || feedback === 'disliked') && (
              <TouchableOpacity
                style={styles.feedbackButton}
                onPress={() => handleFeedback('disliked')}
                disabled={feedback !== null} // Disable if any feedback is given
              >
                <Ionicons
                  name={feedback === 'disliked' ? 'thumbs-down' : 'thumbs-down-outline'}
                  size={18}
                  style={[
                    feedback === 'disliked' ? styles.dislikedIcon : styles.neutralIcon,
                    feedback !== null && feedback !== 'disliked' ? styles.hiddenIcon : {} // Hide if other feedback given
                  ]}
                />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );
};

// Add/Update your styles here:
const styles = StyleSheet.create({
  // ... (keep existing styles: row, userMessageContainer, botMessageContainer, bubble, userBubble, botMessageContainer, bubble, userBubble, botBubble, userMessageText, botMessageText, image, promptText, copyButton, item, btnImage, avatar)
  row: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    marginVertical: 5,
    alignItems: 'flex-end', // Changed to flex-end to align avatar with bottom of bubble
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
    marginLeft: 50,
  },
  botMessageContainer: {
    justifyContent: 'flex-start',
    marginRight: 50,
  },
  bubble: {
    padding: 10,
    borderRadius: 15,
    maxWidth: '90%', // Adjusted from 80%
  },
  userBubble: {
    backgroundColor: Colors.chatgptTextField, // Use ChatGPT text field color
    alignSelf: 'flex-end',
  },
  botBubble: {
    // backgroundColor: Colors.lightGray, // Removed background color
    alignSelf: 'flex-start',
  },
  userMessageText: {
    color: '#fff',
    fontSize: 16,
  },
  botMessageText: { // Added back the missing style
    color: Colors.chatgptText,
    fontSize: 16,
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
    color: '#555',
    marginTop: 4,
  },
  copyButton: {
    // Removed marginTop and alignSelf
  },
  item: { // Bot icon container
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8, // Add margin to separate icon from bubble
  },
  btnImage: { // Bot icon image
    width: 16,
    height: 16,
  },
   avatar: { // User avatar
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.lightGray, // Fallback color
    marginLeft: 8, // Add margin to separate icon from bubble
  },
  // REMOVED the old styles.loading as we integrate loading differently
  streamingIndicator: { // Simple blinking cursor style
    color: Colors.gray, // Or Colors.primary
    // fontWeight: 'bold', // If you want it more prominent
  },
  initialLoadingSpinner: {
    marginVertical: 10, // Give some space if it's the only thing in the bubble
  },
  feedbackActionsContainer: { // Optional: if you want to group buttons
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    // Decide alignment:
    // alignSelf: 'flex-start', // If you want it aligned with bot bubble start
    // Or, if you want it to span more, adjust accordingly
  },
  feedbackButton: {
    paddingHorizontal: 8, // Add some spacing around the icon
    paddingVertical: 4,
  },
  // You might want different colors for active (liked/disliked) icons
  likedIcon: {
    color: Colors.primary, // Or your preferred "liked" color
  },
  dislikedIcon: {
    color: Colors.danger, // Or your preferred "disliked" color
  },
  neutralIcon: {
    color: '#777', // Same as copy button for consistency
  },
  hiddenIcon: {
    display: 'none',
  }
});

export default memo(ChatMessage);
