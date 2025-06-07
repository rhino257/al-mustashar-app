import MessageInput from '@/components/MessageInput';
import Colors from '@/constants/Colors';
import { defaultStyles } from '@/constants/Styles';
import { storage } from '@/utils/Storage';
import { Stack, useLocalSearchParams } from 'expo-router';
// Import useRef
import { useEffect, useState, useRef } from 'react';
import { Image, View, StyleSheet, KeyboardAvoidingView, Platform, Alert, Text } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import NetInfo from '@react-native-community/netinfo'; // Import NetInfo
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
  file_metadata?: { [key: string]: any } | null; // Added for compatibility with ChatMessage
  user_feedback?: string | null; // Added for compatibility with ChatMessage
  isError?: boolean; // Added to flag errored messages
  originalUserQuery?: string; // Added to store the original query for retry
  originalUserId?: string; // Added to store the original user ID for retry
  sources?: Array<{ // Reflects the actual structure from API (id, content, metadata)
    id: string;
    content: string; // API provides content directly
    metadata: {      // API provides metadata as an object
      title?: string; // This can be derived from law_name or other fields
      law_name?: string;
      article_number?: string | number;
      processed_text?: string; // For fallback title
      // Add any other relevant fields from API's metadata object
      [key: string]: any; // Allow other metadata fields
    };
    // Removed: title: string; (now in metadata or derived)
    // Removed: snippet: string; (now is 'content')
    // Removed: source_law?: string; (now in metadata as law_name)
    // Removed: article_number?: string; (now in metadata)
  }>;
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
  const [isLampModeActive, setIsLampModeActive] = useState(false); // State for lamp icon
  const headerHeight = useHeaderHeight(); // Get header height

  // Popup message state
  const [showPopupMessage, setShowPopupMessage] = useState(false);
  const [popupMessageContent, setPopupMessageContent] = useState('');
  const popupTimerRef = useRef<NodeJS.Timeout | null>(null);

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
        Alert.alert("خطأ", "تعذر تحميل الرسائل.");
      });
    } else {
      // console.log("[ChatPage] New chat session or ID missing."); // Removed log
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

  const displayPopupMessage = (text: string) => {
    setPopupMessageContent(text);
    setShowPopupMessage(true);

    if (popupTimerRef.current) {
      clearTimeout(popupTimerRef.current);
    }

    popupTimerRef.current = setTimeout(() => {
      setShowPopupMessage(false);
    }, 2000); // Hide after 2 seconds
  };

  const onLayout = (event: any) => {
    const { height: layoutHeight } = event.nativeEvent.layout;
    setHeight(layoutHeight / 2);
  };

  // --- New function to handle sending with network check ---
  const handleSendMessage = async (text: string, use_reranker: boolean) => {
    const state = await NetInfo.fetch();
    if (!state.isConnected) {
      Alert.alert("خطأ في الاتصال", "لا يوجد اتصال بالإنترنت. الرجاء التحقق من اتصالك والمحاولة مرة أخرى.");
      return; // Stop sending if offline
    }

    // Proceed with original getCompletion logic if online
    await getCompletion(text, use_reranker);
  };

  // --- getCompletion function remains the same (now called by handleSendMessage) ---
  const getCompletion = async (text: string, use_reranker: boolean) => { // Modified to accept use_reranker
    if (!user?.id) {
      Alert.alert("خطأ", "المستخدم غير موثق. لا يمكن إنشاء محادثة.");
      return;
    }

    setIsSending(true); // Set sending to true at the start

    const currentUserId = user.id;
    let currentActiveChatId = chatId;

    // Reverted client-side UUID generation for user message
    const tempUserKey = `user_temp_${Date.now()}`;
    const tempUserMessageId = tempUserKey; // Use key as temp ID

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
      Alert.alert("خطأ", `فشل إرسال الرسالة: ${error.message || 'الرجاء المحاولة مرة أخرى.'}`);
      setMessages(prevMessages => prevMessages.filter(msg => msg.key !== tempUserKey));
      setIsSending(false); // Reset sending state on error
      return;
    }

    // Inside getCompletion function, right before streamRagQuery:
    console.log(`[ChatPage] CHECKPOINT: About to call streamRagQuery. currentActiveChatId: ${currentActiveChatId}, User query: "${text}"`);
    if (!currentActiveChatId) {
        console.error("[ChatPage] FATAL ERROR: currentActiveChatId is undefined/null before streamRagQuery call. Aborting API call.");
        Alert.alert("خطأ فادح", "لا يمكن إرسال الرسالة: جلسة الدردشة غير مهيأة بشكل صحيح.");
        setIsSending(false); // Reset sending state as we cannot proceed
        return;
    }

    // Reverted client-side UUID generation for AI message placeholder
    const botStableKey = `bot_temp_${Date.now() + 1}`; // Use a slightly different timestamp
    const tempBotMessageId = botStableKey; // Use key as temp ID

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
      originalUserQuery: text, // Store original query
      originalUserId: currentUserId, // Store original user ID
    };

    // Add AI placeholder
    // The messages.length useEffect will trigger auto-scroll after this state updates
    setMessages(prev => [...prev, botPlaceholder]);
    console.log(`[ChatPage] Added AI placeholder message with key: ${botStableKey}`);

    // Prevent starting a new stream if one is already active
    if (streamCloserRef.current) {
        console.warn('[ChatPage] Attempted to start a new stream while one is already active. Aborting.');
        setIsSending(false); // Ensure sending state is correct if somehow stuck
        return; // Do not proceed with starting a new stream
    }

    console.log(`[ChatPage] Starting RAG stream for chat ${currentActiveChatId} with query: "${text}", use_reranker: ${use_reranker}`);
    // Store the closer function returned by streamRagQuery
    streamCloserRef.current = await streamRagQuery(
      { query: text, chat_id: currentActiveChatId!, user_id: currentUserId, use_reranker: use_reranker }, // Added user_id and use_reranker
      (receivedStreamEvent: StreamEvent) => {
        const eventType = receivedStreamEvent.event;
        const rawStreamData = receivedStreamEvent.data; // Keep raw data for logging

        let streamData: any = null;
        if (rawStreamData) {
            try {
                streamData = JSON.parse(rawStreamData as string); // PARSE THE STRING
            } catch (e) {
                console.error(`[ChatPage] Failed to parse SSE event data for event '${eventType}':`, rawStreamData, e);
                // Handle parsing error appropriately - maybe update the message with an error indicator
                setMessages((prevMessages: Message[]) => {
                    let updatedMessages = [...prevMessages];
                    let messageToUpdateIndex = updatedMessages.findIndex(m => m.key === botStableKey && !m.is_user_message);
                    if (messageToUpdateIndex !== -1) {
                        let botMsgToUpdate = { ...updatedMessages[messageToUpdateIndex] };
                        const errorMsg = `\n\nError: Failed to parse stream data for event '${eventType}'. Raw data: ${rawStreamData}`;
                        botMsgToUpdate.message_text += errorMsg;
                        // botMsgToUpdate.isError = true; // Optional: add an error flag
                        updatedMessages[messageToUpdateIndex] = botMsgToUpdate;
                        return updatedMessages;
                    }
                    return prevMessages;
                });
                return; // Stop processing this event if parsing fails
            }
        } else {
             console.warn(`[ChatPage] Stream Event: ${eventType} received with no data.`);
             // Depending on the event type, this might be expected or an issue.
             // For 'message_update' or 'message_finalized', lack of data is likely an error.
             // For 'stream_initiated', it might be fine.
             // Add specific checks if needed.
        }

        // console.log(`[ChatPage] Stream Event: ${eventType} received at ${new Date().toISOString()}`, streamData);

        // State update for streaming content - length doesn't change, so no auto-scroll here
        setMessages((prevMessages: Message[]) => {
            let updatedMessages = [...prevMessages];
            let messageToUpdateIndex = -1;

            // Find the message to update using the temporary key first
            messageToUpdateIndex = updatedMessages.findIndex(m => m.key === botStableKey && !m.is_user_message);

            // If the message is found by key, update it
            if (messageToUpdateIndex !== -1) {
                let botMsgToUpdate = { ...updatedMessages[messageToUpdateIndex] };

                // Handle different event types
                switch (eventType) {
                    case 'metadata':
                        // Update ai_message_id and sources if available in metadata
                        if (streamData.ai_message_id && !botMsgToUpdate.ai_message_id) {
                            botMsgToUpdate.ai_message_id = streamData.ai_message_id;
                            // If the message_id is still temporary, update it to the one from metadata
                            if (botMsgToUpdate.message_id === botStableKey) {
                                botMsgToUpdate.message_id = streamData.ai_message_id;
                            }
                        }
                        if (streamData.sources) {
                            console.log('[ChatPage] RAW streamData.sources from METADATA event:', JSON.stringify(streamData.sources, null, 2));
                            botMsgToUpdate.sources = streamData.sources;
                            console.log('[ChatPage] Updated sources for bot message from metadata:', JSON.stringify(botMsgToUpdate.sources, null, 2));
                        }
                        // Handle file_processing_errors from metadata if needed (e.g., display a warning)
                        if (streamData.file_processing_errors && streamData.file_processing_errors.length > 0) {
                             console.warn('[ChatPage] File processing errors reported in metadata:', streamData.file_processing_errors);
                             // You might add a state variable here to show a warning in the UI
                        }
                        break;

                    case 'stream_initiated':
                        // Optional: Update UI state to show stream is initiated
                        console.log('[ChatPage] Stream initiated event received.');
                        break;

                    case 'message_update':
                        // Update message text progressively
                        botMsgToUpdate.message_text = streamData.cumulative_text || botMsgToUpdate.message_text;
                        botMsgToUpdate.loading = true; // Keep loading true while streaming
                        // If ai_message_id is provided in message_update and not already set, update it
                         if (streamData.message_id && !botMsgToUpdate.ai_message_id) {
                            botMsgToUpdate.ai_message_id = streamData.message_id;
                             if (botMsgToUpdate.message_id === botStableKey) {
                                botMsgToUpdate.message_id = streamData.message_id;
                            }
                        }
                        break;

                    case 'message_finalized':
                        // Update with final content, set loading to false
                        botMsgToUpdate.message_text = streamData.full_content || botMsgToUpdate.message_text;
                        botMsgToUpdate.loading = false;

                        // Prioritize persistent_ai_message_id if available
                        if (streamData.persistent_ai_message_id) {
                            botMsgToUpdate.ai_message_id = streamData.persistent_ai_message_id;
                             if (botMsgToUpdate.message_id === botStableKey || botMsgToUpdate.message_id === streamData.message_id) {
                                botMsgToUpdate.message_id = streamData.persistent_ai_message_id;
                            }
                        } else if (streamData.message_id && !botMsgToUpdate.ai_message_id) {
                             // Fallback to message_id if persistent_ai_message_id is not there
                             botMsgToUpdate.ai_message_id = streamData.message_id;
                             if (botMsgToUpdate.message_id === botStableKey) {
                                botMsgToUpdate.message_id = streamData.message_id;
                            }
                        }

                        // Add sources if available in message_finalized
                        if (streamData.metadata?.sources) {
                            console.log('[ChatPage] RAW streamData.metadata.sources from FINALIZED event:', JSON.stringify(streamData.metadata.sources, null, 2));
                            botMsgToUpdate.sources = streamData.metadata.sources;
                            console.log('[ChatPage] Updated sources for bot message from finalized:', JSON.stringify(botMsgToUpdate.sources, null, 2));
                        }

                        // Handle stream errors from message_finalized
                        if (streamData.status === 'error' && streamData.error_details) {
                            console.error('[ChatPage] RAG error during stream (finalized event):', streamData.error_details);
                            const errorMsg = `\n\nError: ${streamData.error_details.user_facing_message || streamData.error_details.error || 'Unknown stream error'}`;
                            botMsgToUpdate.message_text += errorMsg;
                            botMsgToUpdate.isError = true; // Set error flag
                        }

                        // ---- CRITICAL: Explicitly close the connection after finalization ----
                        if (streamCloserRef.current) {
                            streamCloserRef.current(); // Call the closer function
                            streamCloserRef.current = null; // Clear the ref
                            console.log('[ChatPage] SSE stream finalized. Connection explicitly closed and ref cleared.');
                        } else {
                            console.warn('[ChatPage] SSE stream finalized, but no active stream closer found to explicitly close.');
                        }

                        // Ensure isSending is false after finalization
                        setIsSending(false);
                        console.log('[ChatPage] isSending set to false after stream finalization.');

                        break;

                    case 'tool_info':
                        // Handle tool_info if needed, e.g., display tool usage in UI
                        console.log('[ChatPage] Tool info event received:', streamData);
                        // You might add this as a separate message or update the current message state
                        break;

                    default:
                        console.log(`[ChatPage] Unhandled stream event type: ${eventType}`, streamData);
                        break;
                }

                updatedMessages[messageToUpdateIndex] = botMsgToUpdate;
                return updatedMessages;
            } else {
                console.warn(`[ChatPage] Event: ${eventType} - Could not find message with stable key ${botStableKey} to update.`);
                return prevMessages; // Return original messages if placeholder not found
            }
        });
      },
      (error: Error) => { // onError callback
        console.error('[ChatPage] RAG Stream Setup/Connection Error:', error);
        // Find the loading message using the temporary key and update its state
        setMessages(prev => prev.map(msg => {
            if (!msg.is_user_message && msg.key === botStableKey && msg.loading) {
                 console.log(`[ChatPage] onError: Setting loading to false and adding error text for key: ${botStableKey}`);
                 return {
                     ...msg,
                     loading: false,
                     message_text: msg.message_text + `\n\nError: ${error.message || 'Unknown connection error.'}`,
                     isError: true, // Set error flag
                 };
            }
            return msg;
        }));
        Alert.alert('خطأ في الاتصال', `فشل الاتصال بالمساعد: ${error.message}`);
        setIsSending(false); // Set sending to false on error
        streamCloserRef.current = null; // Clear the ref on error
      },
      () => { // onCompletion callback
        // Stream completion
        // Ensure any message that might still be loading is set to false
        setMessages(prev => prev.map(msg =>
            (msg.key === botStableKey && msg.loading) // Ensure we only set loading false if it was still true
            ? { ...msg, loading: false }
            : msg
        ));
        console.log(`[ChatPage] RAG Stream completed for bot key: ${botStableKey}`);
        setIsSending(false);
        streamCloserRef.current = null;
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

  // --- Function to handle retrying a message ---
  const handleRetry = async (messageKey: string) => {
    const messageToRetry = messages.find(msg => msg.key === messageKey);

    if (!messageToRetry || !messageToRetry.originalUserQuery || !messageToRetry.chat_id || !messageToRetry.originalUserId) {
      console.error(`[ChatPage] handleRetry: Could not find message or missing data for key ${messageKey}. Message:`, messageToRetry);
      Alert.alert("خطأ", "تعذر إعادة محاولة الرسالة. البيانات الأساسية مفقودة.");
      return;
    }

    console.log(`[ChatPage] Retrying message for key: ${messageKey}, original query: "${messageToRetry.originalUserQuery}"`);
    setIsSending(true);

    // Update the specific message to show it's retrying
    setMessages(prevMessages =>
      prevMessages.map(msg =>
        msg.key === messageKey
          ? { ...msg, isError: false, loading: true, message_text: '' } // Clear previous error text, set loading
          : msg
      )
    );

    // Ensure any previous stream is closed
    if (streamCloserRef.current) {
      console.log('[ChatPage] handleRetry: Closing existing stream before retrying.');
      streamCloserRef.current();
      streamCloserRef.current = null;
    }

    const { originalUserQuery, chat_id: retryChatId, originalUserId: retryUserId } = messageToRetry;

    // Re-use streamRagQuery logic, targeting the specific messageKey for updates
    streamCloserRef.current = await streamRagQuery(
      { query: originalUserQuery, chat_id: retryChatId, user_id: retryUserId, use_reranker: isLampModeActive },
      (receivedStreamEvent: StreamEvent) => {
        const eventType = receivedStreamEvent.event;
        const rawStreamData = receivedStreamEvent.data;
        let streamData: any = null;
        if (rawStreamData) {
            try {
                streamData = JSON.parse(rawStreamData as string);
            } catch (e) {
                console.error(`[ChatPage] Retry: Failed to parse SSE event data for event '${eventType}':`, rawStreamData, e);
                setMessages((prevMessages: Message[]) => prevMessages.map(msg =>
                    msg.key === messageKey ? { ...msg, loading: false, isError: true, message_text: msg.message_text + `\n\nError: Failed to parse retry stream data.` } : msg
                ));
                return;
            }
        }

        setMessages((prevMessages: Message[]) => {
            return prevMessages.map(msg => {
                if (msg.key === messageKey) {
                    let botMsgToUpdate = { ...msg };
                    switch (eventType) {
                        case 'metadata':
                            if (streamData.ai_message_id && !botMsgToUpdate.ai_message_id) botMsgToUpdate.ai_message_id = streamData.ai_message_id;
                            if (streamData.sources) {
                                console.log('[ChatPage] RETRY RAW streamData.sources from METADATA event:', JSON.stringify(streamData.sources, null, 2));
                                botMsgToUpdate.sources = streamData.sources;
                                console.log('[ChatPage] RETRY Updated sources for bot message from metadata:', JSON.stringify(botMsgToUpdate.sources, null, 2));
                            }
                            break;
                        case 'stream_initiated':
                            break;
                        case 'message_update':
                            botMsgToUpdate.message_text = streamData.cumulative_text || botMsgToUpdate.message_text;
                            botMsgToUpdate.loading = true;
                            if (streamData.message_id && !botMsgToUpdate.ai_message_id) botMsgToUpdate.ai_message_id = streamData.message_id;
                            break;
                        case 'message_finalized':
                            botMsgToUpdate.message_text = streamData.full_content || botMsgToUpdate.message_text;
                            botMsgToUpdate.loading = false;
                            botMsgToUpdate.isError = streamData.status === 'error'; // Set error based on final status
                            if (streamData.status === 'error' && streamData.error_details) {
                                const errorMsg = `\n\nError: ${streamData.error_details.user_facing_message || streamData.error_details.error || 'Unknown stream error'}`;
                                botMsgToUpdate.message_text += errorMsg;
                            }
                            if (streamData.persistent_ai_message_id) botMsgToUpdate.ai_message_id = streamData.persistent_ai_message_id;
                            else if (streamData.message_id && !botMsgToUpdate.ai_message_id) botMsgToUpdate.ai_message_id = streamData.message_id;
                            if (streamData.metadata?.sources) {
                                console.log('[ChatPage] RETRY RAW streamData.metadata.sources from FINALIZED event:', JSON.stringify(streamData.metadata.sources, null, 2));
                                botMsgToUpdate.sources = streamData.metadata.sources;
                                console.log('[ChatPage] RETRY Updated sources for bot message from finalized:', JSON.stringify(botMsgToUpdate.sources, null, 2));
                            }

                            if (streamCloserRef.current) {
                                streamCloserRef.current();
                                streamCloserRef.current = null;
                            }
                            setIsSending(false);
                            break;
                        case 'tool_info':
                            break;
                        default:
                            break;
                    }
                    return botMsgToUpdate;
                }
                return msg;
            });
        });
      },
      (error: Error) => { // onError for retry
        console.error(`[ChatPage] Retry RAG Stream Setup/Connection Error for key ${messageKey}:`, error);
        setMessages(prev => prev.map(msg =>
            msg.key === messageKey
            ? { ...msg, loading: false, isError: true, message_text: msg.message_text + `\n\nRetry Error: ${error.message || 'Unknown connection error.'}` }
            : msg
        ));
        setIsSending(false);
        streamCloserRef.current = null;
      },
      () => { // onCompletion for retry
        setMessages(prev => prev.map(msg =>
            (msg.key === messageKey && msg.loading)
            ? { ...msg, loading: false }
            : msg
        ));
        console.log(`[ChatPage] Retry RAG Stream completed for bot key: ${messageKey}`);
        setIsSending(false);
        streamCloserRef.current = null;
      }
    );
  };

  const toggleLampMode = () => {
    setIsLampModeActive(prevState => !prevState);
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
      <View style={[styles.page, { paddingTop: headerHeight }]} onLayout={onLayout}>
        {messages.length === 0 && (
          <Text style={[{ fontSize: 24, fontWeight: 'bold', color: '#fff', textAlign: 'center' }, { marginTop: height > 100 ? height - 100 : 50 }]}>
            كيف يمكنني مساعدتك؟
          </Text>
        )}
        <FlashList
          // --- 2. Assign Ref ---
          ref={listRef}
          data={messages}
          renderItem={({ item }) => {
            const { key, ...restOfItem } = item;
            // Pass the original item.key as 'messageKeyValue'
            // React's internal key is handled by keyExtractor
            return <ChatMessage {...restOfItem} messageKeyValue={key} handleRetry={handleRetry} displayPopupMessage={displayPopupMessage} />;
          }}
          estimatedItemSize={100}
          contentContainerStyle={{ paddingBottom: 150 }}
          keyboardDismissMode="on-drag"
          keyExtractor={(item: Message) => item.key}
          getItemType={getItemType}
          automaticallyAdjustContentInsets={false}
        />
      </View>

      {/* Popup message View, rendered by ChatPage */}
      {showPopupMessage && (
        <View style={styles.popupMessageView}>
          <Text style={styles.popupMessageText}>{popupMessageContent}</Text>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={70}
        style={styles.keyboardAvoidingView}
      >

        <MessageInput
          key={isSending ? 'sending-input' : 'idle-input'} // Add key based on isSending state
          onShouldSend={handleSendMessage} // Call the new handler
          isSending={isSending} // Pass the isSending state
          onStopSending={handleStopSending} // Pass the stop handler
          isLampActive={isLampModeActive} // Pass the state for lamp icon
          onToggleLamp={toggleLampMode} // Pass the toggle function for lamp icon
          displayPopupMessage={displayPopupMessage} // Pass the display function
        />
      </KeyboardAvoidingView>
    </View>
  );
};

// Styles remain the same
const styles = StyleSheet.create({
  popupMessageView: { // Style for the popup message
    position: 'absolute',
    bottom: 80, // Adjust as needed to be above MessageInput
    left: 10,
    right: 10,
    backgroundColor: Colors.messageInputBackground, // Use MessageInput background color
    borderRadius: 5,
    padding: 10, // Increased padding
    alignItems: 'center',
    zIndex: 1000, // Ensure it's above other elements
    elevation: 5, // For Android shadow
    shadowColor: '#000', // For iOS shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  popupMessageText: { // Style for the popup message text
    color: Colors.white,
    fontSize: 14,
    textAlign: 'center',
  },
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
