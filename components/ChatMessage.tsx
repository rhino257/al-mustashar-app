import React, { useEffect, useState, memo } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ActivityIndicator, Pressable } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard'; // If used for copy
import MarkdownDisplay from 'react-native-markdown-display';
import { Message } from '@/utils/Database'; // Import your Supabase Message type
import { Ionicons } from '@expo/vector-icons';
import * as ContextMenu from 'zeego/context-menu';
import { Link } from 'expo-router'; // Import Link for image modal navigation
import Colors from '@/constants/Colors'; // Import Colors
import { supabase } from '../utils/supabase'; // Import Supabase client

// Define a type for ChatMessage props that omits the 'key' property from Message
// This will now implicitly include 'sources' if Message from Database.ts (or the one from ChatPage.tsx) has it.
// For clarity, we can ensure the Message type used here is the one from ChatPage.tsx if they diverge significantly,
// but for now, we assume compatibility or that ChatPage's Message structure is what's passed.
import { Message as ChatPageMessage } from './ChatPage'; // Assuming ChatPage exports its Message interface

// --- Update ChatMessageProps to include handleRetry and expect messageKeyValue ---
type ChatMessageProps = Omit<ChatPageMessage, 'key'> & { // Omit 'key' from ChatPageMessage as it's React's internal prop
  messageKeyValue: string; // Expect the key value under a different prop name
  handleRetry?: (messageKey: string) => Promise<void> | void;
};

// Props now directly use the Message type from Supabase
const ChatMessage = (props: ChatMessageProps) => { // Add loading prop for streaming indicator
  const [feedback, setFeedback] = useState<string | null>(props.user_feedback || null);
  // Destructure new props
  const { is_user_message, loading, isError, handleRetry, messageKeyValue, message_id } = props;
  const uniqueMessageId = messageKeyValue || message_id; // Use messageKeyValue (formerly item.key) or message_id

  const handleFeedback = async (newFeedbackType: 'liked' | 'disliked') => {
    // Safeguard: Abort if feedback is attempted on a temporary ID
    if (props.message_id.startsWith('temp_')) {
      console.warn(`[ChatMessage] Attempted feedback on temporary message_id: ${props.message_id}. Operation aborted.`);
      // Optionally, provide user feedback like a toast here if desired
      return;
    }

    // Only allow feedback if no feedback has been given yet
    if (feedback !== null) {
      console.log(`[ChatMessage] Feedback already given for message_id: ${props.message_id}. No change.`);
      return; // Exit if feedback is already set
    }

    // If no feedback yet, newFeedbackType is the final state
    const finalFeedbackState = newFeedbackType;

    setFeedback(finalFeedbackState); // Optimistic UI update

    const columnToTarget = props.is_user_message ? 'message_id' : 'ai_message_id';
    const idToUpdateWith = props.is_user_message ? props.message_id : props.ai_message_id;

    if (!idToUpdateWith) {
      console.error(`[ChatMessage] Cannot update feedback: ID to use is missing. is_user_message: ${props.is_user_message}, message_id: ${props.message_id}, ai_message_id: ${props.ai_message_id}`);
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
  //   isUser: props.is_user_message,
  //   messageId: props.message_id,
  //   messageText: props.message_text, // <<< ADD/ENSURE THIS IS LOGGED
  //   messageTextLength: props.message_text?.length,
  //   loading: props.loading,
  //   messageType: props.messageType
  // });
  // const isUser = props.is_user_message; // Already destructured as is_user_message

  const onCopy = () => {
    if (props.message_text) {
      Clipboard.setString(props.message_text);
      // Optionally show a toast or feedback
    }
  };

  // Assuming 'props' is a prop passed to ChatMessage containing the message object
  useEffect(() => {
    // Log only for assistant messages that are being actively streamed or finalized
    if (props.is_user_message === false && props.message_text !== undefined) {
      // Adding a more specific marker if it's the placeholder being updated or a final message
      const renderType = props.message_id.startsWith('temp_') || props.loading === false ? "Render_Update" : "Render_Stream";
      console.log(
        new Date().toISOString(),
        `[RN Log Marker] ChatMessage_${renderType} (ID: ${props.message_id}, TextLength: ${props.message_text?.length || 0})`
      );
    }
  }, [props.message_text, props.message_id, props.is_user_message, props.loading]); // Add all relevant dependencies that trigger re-render


  // Adapt context menu items for image messages
  const contextItems = props.messageType === 'image' && props.file_metadata?.url ? [
    { title: 'Copy Image', systemIcon: 'doc.on.doc', action: () => copyImageToClipboard(props.file_metadata!.url as string) },
    {
      title: 'Save to Photos',
      systemIcon: 'arrow.down.to.line',
      action: () => downloadAndSaveImage(props.file_metadata!.url as string),
    },
    { title: 'Share Image', systemIcon: 'square.and.arrow.up', action: () => shareImage(props.file_metadata!.url as string) },
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
      is_user_message ? styles.userMessageContainer : styles.botMessageContainer,
    ]}>
      {/* User Avatar or Bot Icon */}
      {is_user_message ? (
         null // Removed user avatar
      ) : (
        // Removed bot icon
        null
      )}


      {/* Message Bubble Area */}
      <View style={[styles.bubble, is_user_message ? styles.userBubble : styles.botBubble]}>
        {/* Handle text messages - RENDER TEXT ALWAYS IF IT EXISTS */}
        {(props.messageType === 'text' || !props.messageType) && props.message_text ? (
          <MarkdownDisplay
            style={{
              body: is_user_message ? styles.userMessageText : styles.botMessageText,
              // Add other markdown element styles here if needed
            }}
          >
            {props.message_text}
          </MarkdownDisplay>
        ) : null}
        {/* Optionally, show a subtle loading indicator next to streaming text for non-user messages */}
        {!is_user_message && loading && props.message_text && (props.messageType === 'text' || !props.messageType) && <Text style={styles.streamingIndicator}>▋</Text>}


        {/* Handle image messages */}
        {props.messageType === 'image' && props.file_metadata?.url && (
          <ContextMenu.Root>
            <ContextMenu.Trigger>
              <Link
                href={`/(auth)/(modal)/image/${encodeURIComponent(
                  props.file_metadata.url as string
                )}?prompt=${encodeURIComponent(props.file_metadata.prompt as string || '')}`}
                asChild>
                <Pressable>
                  <Image source={{ uri: props.file_metadata.url as string }} style={styles.image} />
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
        {props.messageType === 'image' && props.file_metadata?.prompt && (
           <Text style={styles.promptText}>Prompt: {props.file_metadata.prompt as string}</Text>
        )}

        {/* Show a general loading indicator if it's a bot message, loading, AND there's NO text yet OR it's not a text message type being loaded */}
        {!is_user_message && loading && (!props.message_text && props.messageType === 'text')}
        {/* The above line is a condition. If you want to show the ActivityIndicator when no text has arrived yet: */}
        {!is_user_message && loading && !props.message_text && (
             <ActivityIndicator color={Colors.primary} size="small" style={styles.initialLoadingSpinner} />
        )}

        {/* Display sources if available for bot messages */}
        {!is_user_message && props.sources && props.sources.length > 0 && (
          <View style={styles.sourcesContainer}>
            <Text style={styles.sourcesTitle}>Sources:</Text>
            {props.sources.map((source) => (
              <View key={source.id} style={styles.sourceItem}>
                <Text style={styles.sourceTitle}>{source.title}</Text>
                <Text style={styles.sourceSnippet} numberOfLines={2} ellipsizeMode="tail">
                  {source.snippet}
                </Text>
                {/* Optionally display source_law and article_number if needed */}
                {/* <Text style={styles.sourceMeta}>{source.source_law} - Art. {source.article_number}</Text> */}
              </View>
            ))}
          </View>
        )}

        {/* Feedback buttons for bot messages - only show if ID is not temporary */}
        {!is_user_message && !loading && props.message_text && !uniqueMessageId?.startsWith('temp_') && (
          <View style={styles.feedbackActionsContainer}>
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

            {/* Retry/Regenerate Button - Condition changed to show for all non-loading bot messages */}
            {handleRetry && uniqueMessageId && ( // Removed isError condition, icon appears if handleRetry is present
              <TouchableOpacity
                style={styles.feedbackButton}
                onPress={() => handleRetry(uniqueMessageId)}
              >
                <Ionicons name="refresh-outline" size={18} style={styles.neutralIcon} />
              </TouchableOpacity>
            )}

            {/* Copy Button - MOVED HERE as the last item */}
            {/* The condition for copy button specifically for text messages is still relevant if feedback icons might appear for non-text messages later */}
            {(props.messageType === 'text' || !props.messageType) && (
              <TouchableOpacity onPress={onCopy} style={styles.feedbackButton}>
                <Ionicons name="copy-outline" size={18} color="#777" />
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
    width: '100%', // Ensure the row takes full width
  },
  userMessageContainer: {
    justifyContent: 'flex-start', 
    // marginLeft: 50, // Removed
  },
  botMessageContainer: {
    justifyContent: 'flex-end', // Align bot message container to the right
    alignSelf: 'flex-end', // Ensure the entire bot message container aligns to the right
    // marginRight: 50, // Removed
  },
  bubble: {
    padding: 10,
    borderRadius: 15,
    maxWidth: '90%', // Adjusted from 80%
  },
  userBubble: {
    backgroundColor: Colors.chatgptTextField, // Use ChatGPT text field color
    alignSelf: 'flex-start', // User bubble on the left
  },
  botBubble: {
    // backgroundColor: Colors.lightGray, // Removed background color
    alignSelf: 'flex-end', // Align bot bubble to the right
  },
  userMessageText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'left', // User message text align left
  },
  botMessageText: { // Added back the missing style
    color: Colors.chatgptText,
    fontSize: 16,
    textAlign: 'right', // Align bot message text to the right
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
    justifyContent: 'flex-end', // Align icons to the right
    alignSelf: 'flex-end', // Ensure the container itself aligns to the right within its parent
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
  },
  sourcesContainer: {
    marginTop: 10,
    paddingTop: 5,
    borderTopWidth: 1,
    borderColor: Colors.lightGray, // Use a color from your Colors constant
    alignSelf: 'flex-end', // Align sources container to the right
  },
  sourcesTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.chatgptText, // Use a color from your Colors constant
    marginBottom: 5,
    textAlign: 'right', // Align sources title to the right
  },
  sourceItem: {
    marginBottom: 8,
    paddingRight: 10, // Indent source items slightly (from the right)
    alignItems: 'flex-end', // Align content of source item to the right
  },
  sourceTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.chatgptText, // Use a color from your Colors constant
    textAlign: 'right', // Align source title to the right
  },
  sourceSnippet: {
    fontSize: 12,
    color: Colors.gray, // Use a color from your Colors constant
    textAlign: 'right', // Align source snippet to the right
  },
  // sourceMeta: { // Optional style for law/article
  //   fontSize: 11,
  //   color: Colors.mediumGray, // Use a color from your Colors constant
  //   textAlign: 'right',
  // },
  sourcesToggleContainer: { // Container for the toggle header and the list
    marginTop: 10,
    paddingTop: 5,
    borderTopWidth: 1,
    borderColor: Colors.lightGray,
    alignSelf: 'flex-end', // Align the whole sources section to the right
    width: '100%', // Ensure it takes full width within the bubble
  },
  sourcesToggleHeader: { // The clickable header part
    flexDirection: 'row',
    justifyContent: 'flex-end', // Align title and icon to the right
    alignItems: 'center',
    paddingVertical: 5, // Add some padding for touch area
  },
  sourcesList: { // The container for the actual source items
    marginTop: 5, // Space between header and list
  },
});

export default memo(ChatMessage);
