import HeaderDropDown from '@/components/HeaderDropDown';
import MessageInput from '@/components/MessageInput';
import { defaultStyles } from '@/constants/Styles';
import { keyStorage, storage } from '@/utils/Storage';
import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, View, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useMMKVString } from 'react-native-mmkv';
import OpenAI from 'react-native-openai';
import { FlashList } from '@shopify/flash-list';
import ChatMessage from '@/components/ChatMessage';
import { Role } from '@/utils/Interfaces'; // Keep Role enum if still used for UI logic
import MessageIdeas from '@/components/MessageIdeas';
import { addChat, getMessages, addMessageToSupabase, addAssistantMessageViaFunction, Message, Chat } from '@/utils/Database'; // Import Supabase functions and types
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth to get user ID
import { streamRagQuery, StreamEvent } from '@/utils/api'; // Import RAG streaming functions and types


const ChatPage = () => {
  const [gptVersion, setGptVersion] = useMMKVString('gptVersion', storage);
  // Get user ID from AuthContext
  const { user } = useAuth();
  const [height, setHeight] = useState(0);
  const [key, setKey] = useMMKVString('apikey', keyStorage);
  const [organization, setOrganization] = useMMKVString('org', keyStorage);
  const [messages, setMessages] = useState<Message[]>([]); // Use new Message type
  let { id } = useLocalSearchParams<{ id: string }>();

// if (!key || key === '' || !organization || organization === '') {
//   return <Redirect href={'/(auth)/(modal)/settings'} />;
// }

  const [chatId, _setChatId] = useState<string | undefined>(id); // Explicitly type chatId
  const chatIdRef = useRef(chatId);
  // https://stackoverflow.com/questions/55265255/react-usestate-hook-event-handler-using-initial-state
  function setChatId(id: string | undefined) { // Allow undefined for new chats
    chatIdRef.current = id;
    _setChatId(id);
  }

  // Re-enable/Update useEffect for Fetching Messages
  useEffect(() => {
    // This effect now handles loading messages when the chat_id (from route) changes
    const currentChatIdFromRoute = id; // id from useLocalSearchParams
    if (currentChatIdFromRoute && currentChatIdFromRoute !== 'new') {
      setChatId(currentChatIdFromRoute); // Keep local chatId state in sync
      // setLoadingMessages(true); // Optional: set a loading state
      getMessages(currentChatIdFromRoute).then((fetchedMessages: Message[]) => { // Explicitly type fetchedMessages
        setMessages(fetchedMessages);
      }).catch((error: any) => { // Explicitly type error
        console.error("Failed to load messages for chat:", currentChatIdFromRoute, error);
        Alert.alert("Error", "Could not load messages.");
      }).finally(() => {
        // setLoadingMessages(false);
      });
    } else {
      setMessages([]); // Clear messages if it's a new chat or no id
      setChatId(undefined);
    }
  }, [id]); // Depend on 'id' from route params

  const onGptVersionChange = (version: string) => {
    setGptVersion(version);
  };

  const onLayout = (event: any) => {
    const { height } = event.nativeEvent.layout;
    setHeight(height / 2);
  };

  const getCompletion = async (text: string) => {
    // Ensure user is authenticated before creating a chat
    if (!user?.id) {
      Alert.alert("Error", "User not authenticated. Cannot create chat.");
      return;
    }

    const currentUserId = user.id;
    const currentChatId = chatIdRef.current;


    if (messages.length === 0) {
      // Create a new chat in Supabase
      try {
        const newChatSession = await addChat(currentUserId, text, gptVersion); // Call new addChat
        const newChatId = newChatSession.chat_id; // Get the new chat_id (UUID string)

        setChatId(newChatId); // Update local state with the new string ID
        chatIdRef.current = newChatId; // Also update ref immediately

        // Add the first user message to local state and save to DB
        const tempUserMessageId = `temp_${Date.now()}`; // Use a temporary ID
        const localUserMessage: Message = {
            message_id: tempUserMessageId,
            chat_id: newChatId,
            user_id: currentUserId,
            message_text: text,
            message_timestamp: new Date().toISOString(),
            is_user_message: true,
            messageType: 'text',
            // Add other fields if needed for local display
        };
        setMessages(prevMessages => [...prevMessages, localUserMessage]);

        try {
            const savedUserMessage = await addMessageToSupabase(newChatId, currentUserId, text);
            // Optional: Update local message with ID from DB if you want to replace temp ID
            setMessages(prevMessages => prevMessages.map(msg =>
                msg.message_id === tempUserMessageId ? savedUserMessage : msg
            ));
        } catch (dbError) {
            console.error("Failed to save user message to DB:", dbError);
            Alert.alert("Error", "Could not send message. Please try again.");
            // Optionally remove the local message or mark it as failed
            setMessages(prevMessages => prevMessages.filter(msg => msg.message_id !== tempUserMessageId));
            return; // Stop if user message failed to save
        }

        // Optional: Redirect to the new chat URL after successful creation and saving first message
        // router.replace(`/(auth)/(drawer)/(chat)/${newChatId}`);


      } catch (error) {
        console.error("Failed to create new chat:", error);
        Alert.alert("Error", "Failed to create new chat.");
        // Handle error appropriately
        return; // Stop execution if chat creation fails
      }
    } else {
       // For existing chats: Add user message locally and save to DB
       const tempUserMessageId = `temp_${Date.now()}`; // Use a temporary ID
       const localUserMessage: Message = {
           message_id: tempUserMessageId,
           chat_id: currentChatId!, // Use existing chatId
           user_id: currentUserId,
           message_text: text,
           message_timestamp: new Date().toISOString(),
           is_user_message: true,
           messageType: 'text',
           // Add other fields if needed for local display
       };
       setMessages(prevMessages => [...prevMessages, localUserMessage]);

       try {
           const savedUserMessage = await addMessageToSupabase(currentChatId!, currentUserId, text);
           // Optional: Update local message with ID from DB if you want to replace temp ID
           setMessages(prevMessages => prevMessages.map(msg =>
               msg.message_id === tempUserMessageId ? savedUserMessage : msg
           ));
       } catch (dbError) {
           console.error("Failed to save user message to DB:", dbError);
           Alert.alert("Error", "Could not send message. Please try again.");
           // Optionally remove the local message or mark it as failed
           setMessages(prevMessages => prevMessages.filter(msg => msg.message_id !== tempUserMessageId));
           return; // Stop if user message failed to save
       }
    }

    // Add a temporary "loading" bot message to local state before starting stream
    const tempBotMessageId = `temp_bot_${Date.now()}`;
    setMessages(prev => [...prev, {
        message_id: tempBotMessageId, // Temporary ID
        chat_id: chatIdRef.current!,
        user_id: 'ASSISTANT_USER_ID', // Or however you identify assistant - needs to match your DB/Function logic
        message_text: '', // Starts empty
        message_timestamp: new Date().toISOString(), // Use current time for local display
        is_user_message: false,
        loading: true, // Add loading flag
        message_type: 'text',
    }]);


    // Comment out OpenAI streaming for RAG API test
    // openAI.chat.stream({
    //   messages: [
    //     {
    //       role: 'user', // OpenAI API still expects 'user' role
    //       content: text,
    //     },
    //     // You might need to include previous messages here for context
    //     // This requires fetching previous messages and formatting them for the OpenAI API
    //     // This is a larger task for a later stage (RAG integration)
    //   ],
    //   model: gptVersion == '4' ? 'gpt-4' : 'gpt-3.5-turbo',
    // });

    const currentActiveChatId = chatIdRef.current; // Use the ref as it's updated immediately

    if (!currentActiveChatId) {
        Alert.alert("Error", "Chat session not available for RAG query.");
        // Clean up temp bot message if it was added
        setMessages(prev => prev.filter(msg => msg.message_id !== tempBotMessageId));
        return;
    }

    streamRagQuery(
        { query: text, chat_id: currentActiveChatId },
        (event: StreamEvent) => { // onStreamEvent callback
            console.log('RAG Event:', event.event, event.data);
            setMessages(prevMessages => {
                const lastMsgIndex = prevMessages.length - 1;
                if (lastMsgIndex < 0) return prevMessages;

                let updatedMessages = [...prevMessages];
                const currentBotMessage = { ...updatedMessages[lastMsgIndex] };

                // Ensure we are updating the correct loading message
                if (!currentBotMessage || currentBotMessage.is_user_message || !currentBotMessage.loading) {
                    // This might happen if events arrive after we thought it was done,
                    // or if the last message isn't the one we expect.
                    // Consider finding the loading message by its temp ID if set.
                    console.warn("Trying to update non-loading or user message with stream event.");
                    return prevMessages;
                }

                let messageIdToUseForSaving = currentBotMessage.message_id;

                if (event.event === 'metadata') {
                    if (event.data.ai_message_id && currentBotMessage.message_id.startsWith('temp_bot_')) {
                        currentBotMessage.message_id = event.data.ai_message_id;
                        messageIdToUseForSaving = event.data.ai_message_id; // Update the ID used for saving
                    }
                    // You might also want to store event.data.file_processing_errors to display them
                } else if (event.event === 'stream_initiated') {
                    // currentBotMessage.status_text = event.data.status; // If you have a field for this
                } else if (event.event === 'message_update') {
                    currentBotMessage.message_text = event.data.full_content;
                    // currentBotMessage.sources = event.data.metadata?.sources; // If handling sources
                } else if (event.event === 'message_finalized') {
                    currentBotMessage.message_text = event.data.full_content;
                    currentBotMessage.loading = false;
                    // currentBotMessage.sources = event.data.metadata?.sources;

                    if (event.data.status === 'error' && event.data.error_details) {
                        console.error('RAG error during stream (finalized event):', event.data.error_details);
                        currentBotMessage.message_text += `\n\nError: ${event.data.error_details.user_facing_message || event.data.error_details.error}`;
                        // For errors during stream, we might not want to save to DB, or save with an error flag.
                        // For now, we just display error.
                    } else if (event.data.status !== 'error') {
                        // Save the successfully finalized assistant message to DB
                        // Use the potentially updated messageIdToUseForSaving
                        addAssistantMessageViaFunction(
                            currentActiveChatId, // Use the chatId active when stream started
                            currentBotMessage.message_text,
                            undefined, // tokens_used
                            'text',    // messageType
                            undefined  // file_metadata (or event.data.metadata if you want to store RAG sources)
                        )
                        .then(savedBotMessage => {
                            // Update local message with actual ID from DB and ensure loading is false
                            setMessages(prev => prev.map(msg =>
                                msg.message_id === messageIdToUseForSaving // Match by the ID used for saving
                                ? { ...savedBotMessage, loading: false }
                                : msg
                            ));
                        })
                        .catch(dbError => {
                            console.error("Failed to save FINAL assistant message to DB:", dbError);
                            Alert.alert("Error", "Assistant response could not be saved.");
                            // The message is displayed; mark as unsaved if needed
                            setMessages(prev => prev.map(msg =>
                                msg.message_id === messageIdToUseForSaving
                                ? { ...msg, loading: false, message_text: `${msg.message_text} [Save Failed]` }
                                : msg
                            ));
                        });
                    }
                }
                updatedMessages[lastMsgIndex] = currentBotMessage;
                return updatedMessages;
            });
        },
        (error: Error) => { // onStreamError callback (network/request setup errors)
            console.error('RAG Stream Setup Error (ChatPage):', error.message);
            Alert.alert('Connection Error', `Failed to connect to assistant: ${error.message}`);
            // Update UI: remove loading indicator from temp bot message and show error
            setMessages(prev => prev.map(msg =>
                (msg.loading && !msg.is_user_message) // Find the loading bot message
                ? { ...msg, loading: false, message_text: `Error connecting to assistant: ${error.message}` }
                : msg
            ));
        },
        () => { // onStreamComplete callback (stream ended naturally)
            console.log('RAG Stream Naturally Completed (ChatPage)');
            // Ensure any final loading states are off.
            // Most finalization is handled by 'message_finalized' event.
             setMessages(prev => prev.map(msg =>
                (msg.loading && !msg.is_user_message) ? { ...msg, loading: false } : msg
            ));
        }
    );
  };

  return (
    <View style={defaultStyles.pageContainer}>
      <Stack.Screen
        options={{
          // Temporarily commented out HeaderDropDown to investigate MenuView error
          // headerTitle: () => (
          //   <HeaderDropDown
          //     title="ChatGPT"
          //     items={[
          //       { key: '3.5', title: 'GPT-3.5', icon: 'bolt' },
          //       { key: '4', title: 'GPT-4', icon: 'sparkles' },
          //     ]}
          //     onSelect={onGptVersionChange}
          //     selected={gptVersion}
          //   />
          // ),
          headerTitle: 'ChatGPT', // Provide a fallback title
        }}
      />
      <View style={styles.page} onLayout={onLayout}>
        {messages.length == 0 && (
          <View style={[styles.logoContainer, { marginTop: height / 2 - 100 }]}>
            <Image source={require('@/assets/images/logo-white.png')} style={styles.image} />
          </View>
        )}
        <FlashList
          data={messages}
          renderItem={({ item }) => <ChatMessage {...item} />} // ChatMessage needs to adapt to new Message type
          estimatedItemSize={400}
          contentContainerStyle={{ paddingTop: 30, paddingBottom: 150 }}
          keyboardDismissMode="on-drag"
          keyExtractor={(item) => item.message_id} // Use message_id for key
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={70}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
        }}>
        {messages.length === 0 && <MessageIdeas onSelectCard={getCompletion} />}
        <MessageInput onShouldSend={getCompletion} />
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
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
    resizeMode: 'cover',
  },
  page: {
    flex: 1,
  },
});
export default ChatPage;
