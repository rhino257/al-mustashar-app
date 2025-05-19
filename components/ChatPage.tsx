import MessageInput from '@/components/MessageInput';
import Colors from '@/constants/Colors';
import { defaultStyles } from '@/constants/Styles';
import { storage } from '@/utils/Storage';
import { Stack, useLocalSearchParams } from 'expo-router';
// Import useRef
import { useEffect, useState, useRef } from 'react';
import { Image, View, StyleSheet, KeyboardAvoidingView, Platform, Alert, Text } from 'react-native';
import { useMMKVString } from 'react-native-mmkv';
// Import FlashList type for the ref
import { FlashList } from '@shopify/flash-list';
import ChatMessage from '@/components/ChatMessage';
import MessageIdeas from '@/components/MessageIdeas';
import { addChat, getMessages, addMessageToSupabase, Chat } from '@/utils/Database';
import { useAuth } from '@/contexts/AuthContext';
import { streamRagQuery, StreamEvent } from '@/utils/api';
import uuid from 'react-native-uuid';

// --- Define the Message Interface ---
export interface Message {
  key: string;
  message_id: string;
  chat_id: string;
  user_id: string;
  message_text: string;
  message_timestamp: string;
  is_user_message: boolean;
  loading?: boolean;
  messageType: 'text' | string;
  ai_message_id?: string | null; // Added to store RAG AI ID
}
// --- End Message Interface Definition ---

const ASSISTANT_USER_ID_CONST = 'ASSISTANT_USER_ID';

const ChatPage = () => {
  const [gptVersion, setGptVersion] = useMMKVString('gptVersion', storage);
  const { user } = useAuth();
  const [height, setHeight] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  let { id } = useLocalSearchParams<{ id: string }>();

  const [chatId, setChatId] = useState<string | undefined>(id === 'new' ? undefined : id);
  const [isSending, setIsSending] = useState(false); // Added isSending state
  const [_, setUpdateTrigger] = useState(0); // Dummy state to force re-render

  // Ref to store the stream closer function
  const streamCloserRef = useRef<(() => void) | null>(null);

  // --- 1. Create a Ref for FlashList ---
  const listRef = useRef<FlashList<Message>>(null);

  // --- Effect for Loading Initial Messages ---
  useEffect(() => {
    const currentChatIdFromRoute = id;
    if (currentChatIdFromRoute && currentChatIdFromRoute !== 'new') {
      console.log(`[ChatPage] Loading messages for existing chat: ${currentChatIdFromRoute}`);
      setChatId(currentChatIdFromRoute);
      getMessages(currentChatIdFromRoute).then((fetchedMessages: any[]) => {
        const messagesWithKeys = fetchedMessages.map((msg): Message => ({
          ...msg,
          key: msg.message_id || `db_${uuid.v4()}`,
          message_id: msg.message_id,
          chat_id: msg.chat_id,
          user_id: msg.user_id,
          message_text: msg.message_text,
          message_timestamp: msg.message_timestamp,
          is_user_message: msg.is_user_message,
          messageType: msg.messageType || 'text',
        }));
        setMessages(messagesWithKeys);
        console.log(`[ChatPage] Loaded ${messagesWithKeys.length} messages.`);
        // Note: Auto-scroll will be handled by the messages.length effect below
      }).catch((error: any) => {
        console.error("[ChatPage] Failed to load messages for chat:", currentChatIdFromRoute, error);
        Alert.alert("Error", "Could not load messages.");
      });
    } else {
      console.log("[ChatPage] New chat session or ID missing.");
      setMessages([]);
      setChatId(undefined);
    }
  }, [id]);

  // Effect to force MessageInput re-render when isSending changes
  useEffect(() => {
    setUpdateTrigger(prev => prev + 1);
  }, [isSending]);

  // --- 3. Effect for Auto-Scrolling ---
  useEffect(() => {
    if (messages.length > 0) {
      // Scroll to end when the number of messages increases (new message added or initial load)
      const timer = setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 50); // Short delay to allow render completion

      // Cleanup timeout if effect re-runs before timeout finishes
      return () => clearTimeout(timer);
    }
  }, [messages.length]); // Depend only on the length changing


  const onLayout = (event: any) => {
    const { height: layoutHeight } = event.nativeEvent.layout;
    setHeight(layoutHeight / 2);
  };

  // --- getCompletion function remains the same ---
  const getCompletion = async (text: string) => {
    if (!user?.id) {
      Alert.alert("Error", "User not authenticated. Cannot create chat.");
      return;
    }

    setIsSending(true); // Set sending to true at the start

    const currentUserId = user.id;
    let currentActiveChatId = chatId;

    const tempUserKey = `user_${uuid.v4()}`;
    const tempUserMessageId = `temp_${tempUserKey}`;

    const localUserMessage: Message = {
      key: tempUserKey,
      message_id: tempUserMessageId,
      chat_id: currentActiveChatId || 'new_chat_pending',
      user_id: currentUserId,
      message_text: text,
      message_timestamp: new Date().toISOString(),
      is_user_message: true,
      messageType: 'text',
    };

    // Add user message optimistically
    // The messages.length useEffect will trigger auto-scroll after this state updates
    setMessages(prevMessages => [...prevMessages, localUserMessage]);
    console.log(`[ChatPage] Optimistically added user message with key: ${tempUserKey}`);


    try {
      if (!currentActiveChatId) {
        console.log("[ChatPage] Creating new chat session.");
        try {
          const newChatSession = await addChat(currentUserId, text, gptVersion || 'default');
          currentActiveChatId = newChatSession.chat_id;
          setChatId(currentActiveChatId);
          console.log(`[ChatPage] New chat created with ID: ${currentActiveChatId}`);

          setMessages(prev => prev.map(msg =>
            msg.key === tempUserKey ? { ...msg, chat_id: currentActiveChatId! } : msg
          ));
        } catch (chatError: any) {
          console.error("[ChatPage] Error during addChat:", chatError);
          // Re-throw the error so the outer catch block can handle cleanup
          throw chatError;
        }
      }

      if (!currentActiveChatId) {
         throw new Error("Failed to establish chat ID after attempting creation.");
      }

      console.log(`[ChatPage] Saving user message to DB for chat ${currentActiveChatId}`);
      const savedUserMessageData = await addMessageToSupabase(currentActiveChatId, currentUserId, text);

      setMessages(prevMessages => prevMessages.map(msg =>
        msg.key === tempUserKey
          ? { ...msg, message_id: savedUserMessageData.message_id }
          : msg
      ));
      console.log(`[ChatPage] User message updated with permanent ID: ${savedUserMessageData.message_id}`);

    } catch (error: any) {
      console.error("[ChatPage] Failed to create chat or save user message:", error);
      Alert.alert("Error", `Failed to send message: ${error.message || 'Please try again.'}`);
      setMessages(prevMessages => prevMessages.filter(msg => msg.key !== tempUserKey));
      setIsSending(false); // Reset sending state on error
      return;
    }

    // Inside getCompletion function, right before streamRagQuery:
    console.log(`[ChatPage] CHECKPOINT: About to call streamRagQuery. currentActiveChatId: ${currentActiveChatId}, User query: "${text}"`);
    if (!currentActiveChatId) {
        console.error("[ChatPage] FATAL ERROR: currentActiveChatId is undefined/null before streamRagQuery call. Aborting API call.");
        Alert.alert("Critical Error", "Cannot send message: Chat session is not properly initialized.");
        setIsSending(false); // Reset sending state as we cannot proceed
        return;
    }

    const botStableKey = `bot_${uuid.v4()}`;
    const tempBotMessageId = `temp_${botStableKey}`;

    const botPlaceholder: Message = {
      key: botStableKey,
      message_id: tempBotMessageId,
      chat_id: currentActiveChatId,
      user_id: ASSISTANT_USER_ID_CONST,
      message_text: '',
      message_timestamp: new Date().toISOString(),
      is_user_message: false,
      loading: true,
      messageType: 'text',
    };

    // Add AI placeholder
    // The messages.length useEffect will trigger auto-scroll after this state updates
    setMessages(prev => [...prev, botPlaceholder]);
    console.log(`[ChatPage] Added AI placeholder message with key: ${botStableKey}`);

    console.log(`[ChatPage] Starting RAG stream for chat ${currentActiveChatId} with query: "${text}"`);
    // Store the closer function returned by streamRagQuery
    streamCloserRef.current = await streamRagQuery(
      { query: text, chat_id: currentActiveChatId! }, // Ensured currentActiveChatId is defined by now
      (receivedStreamEvent: StreamEvent) => {
        const streamData = receivedStreamEvent.data;
        const eventType = receivedStreamEvent.event;

        if (typeof streamData !== 'object' || streamData === null) {
            console.error(`[ChatPage] Stream Error: Event '${eventType}' data is not an object or is null. Data:`, streamData);
            return;
        }
        // console.log(`[ChatPage] Stream Event: ${eventType} received at ${new Date().toISOString()}`);

        // State update for streaming content - length doesn't change, so no auto-scroll here
        setMessages((prevMessages: Message[]) => {
            let updatedMessages = [...prevMessages];
            let messageToUpdateIndex = -1;

            const indexByKey = updatedMessages.findIndex(m => m.key === botStableKey && !m.is_user_message);
            const permanentIdFromEvent = streamData.ai_message_id;
            let indexById = -1;
            if (permanentIdFromEvent) {
                 indexById = updatedMessages.findIndex(m => m.message_id === permanentIdFromEvent && !m.is_user_message);
            }

            if (eventType === 'metadata') {
                messageToUpdateIndex = indexByKey;
                if (messageToUpdateIndex === -1) {
                    console.warn(`[ChatPage] Event: metadata - Could not find message with stable key ${botStableKey} to update ID.`);
                }
            } else {
                 messageToUpdateIndex = indexById !== -1 ? indexById : indexByKey;
                 if (messageToUpdateIndex === -1) {
                     console.warn(`[ChatPage] Event: ${eventType} - Could not find message with ID ${permanentIdFromEvent} or key ${botStableKey}.`);
                 }
            }

            if (messageToUpdateIndex === -1) {
                return prevMessages;
            }

            let botMsgToUpdate = { ...updatedMessages[messageToUpdateIndex] };

            // For message_finalized event, prioritize persistent_ai_message_id
            if (eventType === 'message_finalized' && streamData.persistent_ai_message_id) {
                const persistentId = streamData.persistent_ai_message_id;
                console.log(`[ChatPage] Received persistent_ai_message_id: ${persistentId} in message_finalized event.`);
                botMsgToUpdate.ai_message_id = persistentId;
                if (botMsgToUpdate.message_id && botMsgToUpdate.message_id.startsWith('temp_')) {
                    botMsgToUpdate.message_id = persistentId; // Update message_id to persistent ID as well
                }
            } else if (streamData.ai_message_id) { // Fallback for other events or if persistent_ai_message_id is not in message_finalized
                let idFromStream = streamData.ai_message_id;
                const suffixToRemove = '_ai_response_default';
                if (idFromStream.endsWith(suffixToRemove)) {
                    idFromStream = idFromStream.substring(0, idFromStream.length - suffixToRemove.length);
                    console.log(`[ChatPage] Cleaned (fallback) ai_message_id: ${streamData.ai_message_id} -> ${idFromStream}`);
                }
                // Only set ai_message_id if not already set by persistent_ai_message_id
                if (!botMsgToUpdate.ai_message_id) {
                    botMsgToUpdate.ai_message_id = idFromStream;
                }
                // Update message_id if temporary and not already set by persistent_ai_message_id
                if (botMsgToUpdate.message_id && botMsgToUpdate.message_id.startsWith('temp_') && (!streamData.persistent_ai_message_id || eventType !== 'message_finalized')) {
                    botMsgToUpdate.message_id = idFromStream;
                }
            } else if (eventType === 'metadata' && !streamData.ai_message_id && !streamData.persistent_ai_message_id) {
                 console.error(`[ChatPage] CRITICAL: 'metadata' event received but no ai_message_id or persistent_ai_message_id found. Bot message with key ${botStableKey} may lack necessary IDs.`);
            }


            if (eventType === 'message_update') {
                botMsgToUpdate.message_text = streamData.cumulative_text || botMsgToUpdate.message_text;
                botMsgToUpdate.loading = true;
            } else if (eventType === 'message_finalized') {
                botMsgToUpdate.message_text = streamData.full_content || botMsgToUpdate.message_text;
                botMsgToUpdate.loading = false; // Loading is set to false here
                
                // Ensure ai_message_id is set if persistent_ai_message_id was provided
                if (streamData.persistent_ai_message_id && !botMsgToUpdate.ai_message_id) {
                    botMsgToUpdate.ai_message_id = streamData.persistent_ai_message_id;
                     if (botMsgToUpdate.message_id && botMsgToUpdate.message_id.startsWith('temp_')) {
                        botMsgToUpdate.message_id = streamData.persistent_ai_message_id;
                    }
                }


                if (streamData.status === 'error' && streamData.error_details) {
                    console.error('[ChatPage] RAG error during stream (finalized event):', streamData.error_details);
                    const errorMsg = `\n\nError: ${streamData.error_details.user_facing_message || streamData.error_details.error || 'Unknown stream error'}`;
                    botMsgToUpdate.message_text += errorMsg;
                }
            } else {
                 console.log(`[ChatPage] Unhandled stream event type: ${eventType}`);
            }

            updatedMessages[messageToUpdateIndex] = botMsgToUpdate;
            return updatedMessages;
        });
      },
      (error: Error) => { // onError callback
        console.error('[ChatPage] RAG Stream Setup/Connection Error:', error);
        Alert.alert('Connection Error', `Failed to connect to assistant: ${error.message}`);
        setMessages(prev => prev.map(msg =>
            (msg.key === botStableKey)
            ? { ...msg, loading: false, message_text: `Error connecting: ${error.message}` }
            : msg
        ));
        setIsSending(false); // Set sending to false on error
      },
      () => { // onCompletion callback
        // Stream completion
        setMessages(prev => prev.map(msg =>
            (msg.key === botStableKey && msg.loading) // Ensure we only set loading false if it was still true
            ? { ...msg, loading: false }
            : msg
        ));
        console.log(`[ChatPage] RAG Stream completed for bot key: ${botStableKey}`);
        setIsSending(false); // Set sending to false on completion
        streamCloserRef.current = null; // Clear the ref on completion
      }
    );
  };

  // Function to handle stopping the sending process
  const handleStopSending = () => {
    console.log('[ChatPage] Stop button pressed. Attempting to close stream.');
    if (streamCloserRef.current) {
      streamCloserRef.current(); // Call the closer function immediately
      streamCloserRef.current = null; // Clear the ref
      console.log('[ChatPage] Stream closer called.');
    } else {
      console.warn('[ChatPage] Stop button pressed, but no active stream closer found.');
    }

    // Always update UI states after attempting to close the stream
    setIsSending(false); // Reset sending state for MessageInput

    // Find the bot message that was loading and set its loading state to false
    setMessages(prevMessages =>
      prevMessages.map(msg => {
        if (!msg.is_user_message && msg.loading) {
          console.log(`[ChatPage] handleStopSending: Setting loading to false for message_id: ${msg.message_id}`);
          return { ...msg, loading: false };
        }
        return msg;
      })
    );
    console.log('[ChatPage] Sending state and relevant message loading states reset.');
  };


  const getItemType = (item: Message): string => {
      if (!item.is_user_message) {
          return 'AI';
      } else {
          return 'USER';
      }
  };


  return (
    <View style={[defaultStyles.pageContainer, { backgroundColor: Colors.chatgptBackground }]}>
      <Stack.Screen
        options={{
        }}
      />
      <View style={styles.page} onLayout={onLayout}>
        {messages.length === 0 && (
          <Text style={[{ fontSize: 24, fontWeight: 'bold', color: '#fff', textAlign: 'center' }, { marginTop: height > 100 ? height - 100 : 50 }]}>
            كيف يمكنني مساعدتك؟
          </Text>
        )}
        <FlashList
          // --- 2. Assign Ref ---
          ref={listRef}
          data={messages}
          renderItem={({ item: { key, ...restOfItem } }) => <ChatMessage key={key} {...restOfItem} />}
          estimatedItemSize={100}
          contentContainerStyle={{ paddingTop: 30, paddingBottom: 150 }}
          keyboardDismissMode="on-drag"
          keyExtractor={(item: Message) => item.key}
          getItemType={getItemType}
          automaticallyAdjustContentInsets={false}
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={70}
        style={styles.keyboardAvoidingView}
      >

        <MessageInput
          key={isSending ? 'sending-input' : 'idle-input'} // Add key based on isSending state
          {...{ // Explicitly pass props in an object to potentially influence re-render
            onShouldSend: getCompletion,
            isSending: isSending, // Pass the isSending state
            onStopSending: handleStopSending, // Pass the stop handler
          }}
        />
      </KeyboardAvoidingView>
    </View>
  );
};

// Styles remain the same
const styles = StyleSheet.create({
  headerTitle: {
      fontSize: 18,
      fontWeight: '500',
      color: '#ffffff', // Set header title color to white
      textAlign: 'right',
  },
  logoContainer: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    width: 50,
    height: 50,
    backgroundColor: '#000',
    borderRadius: 50,
  },
  image: {
    width: 30,
    height: 30,
    resizeMode: 'contain',
  },
  page: {
    flex: 1,
    // backgroundColor: defaultStyles.pageContainer.backgroundColor, // Removed conflicting background
  },
  keyboardAvoidingView: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '100%',
  },
});
export default ChatPage;
