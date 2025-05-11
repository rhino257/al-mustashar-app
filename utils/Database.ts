import { Role } from '@/utils/Interfaces'; // Keep Role enum if still used for UI logic
import { supabase } from './supabase'; // Import Supabase client
import { PostgrestResponse, PostgrestSingleResponse } from '@supabase/supabase-js';

// Define or Update Chat Type
export interface Chat {
  chat_id: string; // Was likely 'id: number'
  chat_name: string; // Was likely 'title: string'
  project_id?: string | null; // New, optional
  model_type?: string | null; // New, optional
  user_id: string; // New, though RLS handles filtering
  created_at: string; // Standard Supabase timestamp
  // Add any other fields from your Supabase 'chats' table you want to use in the app
}

// Define the expected return type for addChat
export interface NewChatResponse extends Chat {} // Or a subset if preferred

// Define or Update Message Type
export interface Message {
  message_id: string;        // Was likely 'id: number'
  chat_id: string;           // Was likely 'chat_id: number'
  user_id: string;           // New or different type: represents the sender (user or bot identifier)
  message_text: string;      // Was likely 'content: string'
  message_timestamp: string; // Standard Supabase timestamp
  is_user_message: boolean;  // New: true for user, false for assistant
  tokens_used?: number | null; // New, optional
  messageType?: string | null; // New, optional (e.g., 'text', 'image')
  file_metadata?: { [key: string]: any } | null; // New, JSONB for image/file content (e.g., { url: '...', prompt: '...' })
                            // The 'prompt' field was on the old message type, now potentially in file_metadata for images
  loading?: boolean;         // New: Optional flag for UI loading state during streaming
  // Old fields like 'role' (string) are replaced by 'is_user_message' (boolean) and potentially 'user_id'.
  // Old 'imageUrl' is now part of 'file_metadata' if message_type is 'image'.
  // Old 'prompt' (for DALL-E) would also be part of 'file_metadata' if associated with an image message.
}


// Remove all expo-sqlite specific imports and initialization logic
// import { type SQLiteDatabase } from 'expo-sqlite/next';
// import * as FileSystem from 'expo-file-system';
// export async function migrateDbIfNeeded(db: SQLiteDatabase) { ... }


// Implement getChats Function for Supabase
export const getChats = async (): Promise<Chat[]> => {
  const { data, error }: PostgrestResponse<Chat> = await supabase
    .from('chats')
    .select('chat_id, chat_name, project_id, model_type, user_id, created_at') // Select specific columns
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching chats:', error.message);
    throw error; // Or return empty array: return [];
  }
  return data || []; // Ensure data is not null
};

// Implement addChat Function for Supabase
export const addChat = async (
  userId: string,
  chatName: string,
  modelType?: string | null, // Optional, align with your 'chats' table
  projectId?: string | null  // Optional, align with your 'chats' table
): Promise<NewChatResponse> => { // Or Promise<Chat>
  const newChatData = {
    user_id: userId,
    chat_name: chatName,
    model_type: modelType, // Pass this from app state (e.g., selected GPT version)
    project_id: projectId, // If you have project selection, pass it here
    // created_at and updated_at will be handled by Supabase defaults
  };

  const { data, error }: PostgrestSingleResponse<NewChatResponse> = await supabase
    .from('chats')
    .insert(newChatData)
    .select() // Select all columns of the newly inserted chat
    .single(); // Expect a single record back

  if (error) {
    console.error('Error adding chat:', error.message);
    throw error;
  }
  if (!data) {
    throw new Error('Failed to create chat or retrieve created chat data.');
  }
  return data;
};

// Implement renameChat Function for Supabase
export const renameChat = async (chatId: string, newName: string): Promise<boolean> => {
  const { error } = await supabase
    .from('chats')
    .update({ chat_name: newName })
    .eq('chat_id', chatId);
    // RLS on 'chats' table should ensure only the owner can update.

  if (error) {
    console.error('Error renaming chat:', error.message);
    // Optionally throw error or return false to indicate failure
    return false;
  }
  return true;
};

// Implement Helper for deleteChat in utils/Database.ts
export const deleteChatViaFunction = async (chatId: string): Promise<{ success: boolean; message?: string; error?: string }> => {
  const { data, error } = await supabase.functions.invoke('archive-chat', {
    body: { chat_id: chatId },
  });

  if (error) {
    console.error('Error invoking archive-chat function:', error.message);
    return { success: false, error: error.message };
  }

  // Assuming your function returns a success message or specific data on success
  // e.g., { message: 'Chat archived successfully' }
  if (data && (data.message || data.archived_chat_id)) { // Check for success indicators from function response
     return { success: true, message: data.message || 'Chat deleted successfully' };
  } else {
    // Handle cases where function executed but didn't return expected success data (or returned an error structure)
    console.error('Archive-chat function did not return expected success data:', data);
    return { success: false, error: data?.error || 'Unknown error from archive function.' };
  }
};

// Implement getMessages Function for Supabase
export const getMessages = async (chatId: string): Promise<Message[]> => {
  if (!chatId) {
    console.warn('getMessages called with no chatId');
    return [];
  }
  const { data, error }: PostgrestResponse<Message> = await supabase
    .from('messages')
    .select('*') // Select all columns, or be specific if preferred
    .eq('chat_id', chatId)
    .order('message_timestamp', { ascending: true });

  if (error) {
    console.error(`Error fetching messages for chat ${chatId}:`, error.message);
    throw error; // Or return empty array: return [];
  }
  return data || [];
};

// Implement addMessageToSupabase (for User Messages) in utils/Database.ts
export const addMessageToSupabase = async (
  chatId: string,
  userId: string,
  messageText: string,
  messageType: string = 'text', // Default to 'text'
  fileMetadata?: { [key: string]: any } | null
): Promise<Message> => { // Return the created message
  const newMessageData = {
    chat_id: chatId,
    user_id: userId, // This is auth.uid()
    message_text: messageText,
    is_user_message: true, // Critical: This is a user message
    messageType: messageType,
    file_metadata: fileMetadata || null,
  };

  const { data, error }: PostgrestSingleResponse<Message> = await supabase
    .from('messages')
    .insert(newMessageData)
    .select()
    .single();

  if (error) {
    console.error('Error adding user message:', error.message);
    throw error;
  }
  if (!data) {
    throw new Error('Failed to create user message or retrieve created message data.');
  }
  return data;
};

// Implement addAssistantMessageViaFunction in utils/Database.ts
export const addAssistantMessageViaFunction = async (
  chatId: string,
  messageText: string,
  tokensUsed?: number | null,
  messageType: string = 'text',
  fileMetadata?: { [key: string]: any } | null
): Promise<Message> => { // Expect the function to return the created message
  const { data, error } = await supabase.functions.invoke('add-assistant-message', {
    body: {
      chat_id: chatId,
      message_text: messageText,
      tokens_used: tokensUsed,
      messageType: messageType,
      file_metadata: fileMetadata,
    },
  });

  if (error) {
    console.error('Error invoking add-assistant-message function:', error.message);
    throw error;
  }
  if (!data) { // Or check for specific error structure from your function
    throw new Error('Failed to add assistant message via function or no data returned.');
  }
  return data as Message; // Cast to Message type, assuming function returns the message object
};


// Keep or adapt other functions as needed in later stages
// export const deleteChat = async (db: SQLiteDatabase, chatId: number) => { ... };
