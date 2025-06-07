import React, { useEffect, useState, memo, useRef } from 'react'; // Added useRef
import { View, Text, Image, StyleSheet, TouchableOpacity, ActivityIndicator, Pressable, Alert } from 'react-native'; // Added Alert
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import SourcesDisplay from './SourcesDisplay'; // Import SourcesDisplay
import type { BottomSheetModal } from '@gorhom/bottom-sheet'; // Reverted to BottomSheetModal
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
  displayPopupMessage?: (text: string) => void; // Added prop for displaying popup
};

// Props now directly use the Message type from Supabase
const ChatMessage = (props: ChatMessageProps) => { // Add loading prop for streaming indicator
  const bottomSheetModalRef = useRef<BottomSheetModal>(null); // Reverted to BottomSheetModal

  // Removed verbose log for props.sources content
  // if (props.sources && props.sources.length > 0) {
  //   console.log('[ChatMessage] props.sources AS RECEIVED (first item):', JSON.stringify(props.sources[0], null, 2));
  // }
  const [feedback, setFeedback] = useState<string | null>(props.user_feedback || null);
  const [isSourcesModalVisible, setIsSourcesModalVisible] = useState(false); // State for sources modal
  // Destructure new props
  const { is_user_message, loading, isError, handleRetry, messageKeyValue, message_id } = props;
  const uniqueMessageId = messageKeyValue || message_id; // Use messageKeyValue (formerly item.key) or message_id

  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

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

  const handleLongPressCopy = () => {
    if (props.message_text) {
      Clipboard.setString(props.message_text);
      if (props.displayPopupMessage) {
        props.displayPopupMessage('تم نسخ الرسالة');
      } else {
        Alert.alert('تم نسخ الرسالة'); // Fallback if prop not provided
      }
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
      <Animated.View style={[styles.bubble, is_user_message ? styles.userBubble : styles.botBubble, animatedStyle]}>
        {/* Handle text messages - RENDER TEXT ALWAYS IF IT EXISTS */}
        {(props.messageType === 'text' || !props.messageType) && props.message_text ? (
          <Pressable
            onLongPress={handleLongPressCopy}
            onPressIn={() => {
              scale.value = withTiming(0.95, { duration: 100 });
            }}
            onPressOut={() => {
              scale.value = withTiming(1, { duration: 100 });
            }}
          >
            <MarkdownDisplay
              style={{
                body: is_user_message ? styles.userMessageText : styles.botMessageText,
                // Add other markdown element styles here if needed
              }}
            >
              {props.message_text}
            </MarkdownDisplay>
          </Pressable>
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

        {/* Feedback buttons for bot messages - only show if ID is not temporary */}
        {!is_user_message && !loading && props.message_text && !uniqueMessageId?.startsWith('temp_') && (
          <View style={styles.feedbackActionsContainer}>
            {/* Sources Button - MOVED TO THE START (RIGHTMOST IN RTL) */}
            {!is_user_message && props.sources && props.sources.length > 0 && (
              <TouchableOpacity 
                onPress={() => {
                  console.log('[ChatMessage] Sources button pressed. Setting isSourcesModalVisible to true.');
                  // bottomSheetModalRef.current?.present(); // Removed direct call, rely on SourcesDisplay useEffect via isVisible
                  setIsSourcesModalVisible(true); 
                }} 
                style={[styles.feedbackButton, styles.sourcesButtonInternal]}>
                <Ionicons name="library-outline" size={18} color="#777" />
                <Text style={styles.sourcesButtonText}>المصادر</Text>
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

            {/* Retry/Regenerate Button */}
            {handleRetry && uniqueMessageId && ( 
              <TouchableOpacity
                style={styles.feedbackButton}
                onPress={() => handleRetry(uniqueMessageId)}
              >
                <Ionicons name="refresh-outline" size={18} style={styles.neutralIcon} />
              </TouchableOpacity>
            )}

            {/* Copy Button */}
            {(props.messageType === 'text' || !props.messageType) && (
              <TouchableOpacity onPress={handleLongPressCopy} style={styles.feedbackButton}>
                <Ionicons name="copy-outline" size={18} color="#777" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </Animated.View>

      {/* Sources Modal Display */}
      {!is_user_message && props.sources && props.sources.length > 0 && (
        <SourcesDisplay
          ref={bottomSheetModalRef} // Pass the ref
          isVisible={isSourcesModalVisible}
          sources={props.sources.map(s => {
            // Actual structure of s (from ChatPage.Message.sources, populated by API):
            // s: { id: string; content: string; metadata: { law_name?: string; article_number?: string; processed_text?: string; ... } }
            // Target structure for SourceFromAPI: { id: string; content: string; metadata: { title?, law_name?, article_number? } }
            
            // Log the individual source item 's' from props.sources before mapping
            // console.log('[ChatMessage] Mapping source item s:', JSON.stringify(s, null, 2));

            const mappedSource = {
              id: s.id,
              content: s.content, // Use s.content directly
              metadata: {
                title: s.metadata?.law_name || s.metadata?.processed_text?.substring(0, 70) || 'المصدر', // Use law_name or a snippet of processed_text as title
                law_name: s.metadata?.law_name, // Keep original law_name if available
                article_number: s.metadata?.article_number, // Keep original article_number if available
              }
            };
            // Log the mapped source item
            // console.log('[ChatMessage] Mapped to SourceFromAPI:', JSON.stringify(mappedSource, null, 2));
            return mappedSource;
          })}
          onClose={() => {
            setIsSourcesModalVisible(false);
            // bottomSheetModalRef.current?.dismiss(); // Already handled by useEffect in SourcesDisplay based on isVisible
          }}
        />
      )}
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
  // Removed sourcesContainer, sourcesTitle, sourceItem, sourceTitle, sourceSnippet, sourceMeta as they are no longer used for inline display
  sourcesButtonInternal: { // Style for the new sources button
    flexDirection: 'row',
    alignItems: 'center',
  },
  sourcesButtonText: { // Style for the text "المصادر"
    marginLeft: 5, // Space between icon and text
    color: '#777',
    fontSize: 14, // Adjust as needed
  },
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
