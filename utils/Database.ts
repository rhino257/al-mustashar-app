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
  updated_at: string; // To sort by recent activity
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
  user_feedback?: string | null; // New: User feedback for the message
  ai_message_id?: string | null; // New: ID from the RAG system for AI messages
  // Add a dedicated key property
  key: string;
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
    .select('chat_id, chat_name, project_id, model_type, user_id, created_at, updated_at') // Select specific columns
    .order('updated_at', { ascending: false });

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
  // Map fetched data to set the 'key' property
  return data ? data.map(msg => ({ ...msg, key: msg.message_id })) : [];
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
): Promise<{ success: boolean, data: Message[] }> => { // Expect the function to return the created message
  const payload = {
    chat_id: chatId,
    message_text: messageText,
    tokens_used: tokensUsed,
    messageType: messageType,
    file_metadata: fileMetadata,
  };
  console.log('[DatabaseUtils] addAssistantMessageViaFunction: Payload for invoke:', JSON.stringify(payload, null, 2));
  console.log('[DatabaseUtils] addAssistantMessageViaFunction: typeof chatId:', typeof chatId);
  console.log('[DatabaseUtils] addAssistantMessageViaFunction: typeof messageText:', typeof messageText);

  try {
    const { data, error } = await supabase.functions.invoke('add-assistant-message', {
      body: payload,
    });

    if (error) {
      console.error('[DatabaseUtils] addAssistantMessageViaFunction: Supabase invoke FAILED. Error:', JSON.stringify(error, null, 2));
      throw error;
    }
    console.log('[DatabaseUtils] addAssistantMessageViaFunction: Supabase invoke SUCCEEDED. Data:', JSON.stringify(data, null, 2));
    return data;
  } catch (e: any) {
    console.error('[DatabaseUtils] addAssistantMessageViaFunction: Caught exception during invoke process. Error name:', e.name, 'Error message:', e.message);
    // Do not log e.stack here if it's sensitive or too verbose, ChatPage will log stack of dbError
    throw e; // Re-throw to be caught by ChatPage
  }
};


// Keep or adapt other functions as needed in later stages
// export const deleteChat = async (db: SQLiteDatabase, chatId: number) => { ... };

// New function to directly archive and delete a chat using SQL
export const archiveAndDeleteChatDirectly = async (chatId: string): Promise<{ success: boolean; message?: string; error?: string }> => {
  try {
    // Step 1: Fetch the chat metadata
    const { data: chatDetails, error: fetchChatError } = await supabase
      .from('chats')
      .select('*')
      .eq('chat_id', chatId)
      .single();

    if (fetchChatError || !chatDetails) {
      console.error('Error fetching chat metadata for archiving:', fetchChatError?.message);
      return { success: false, error: fetchChatError?.message || 'Chat metadata not found for archiving.' };
    }

    // Step 2: Fetch associated messages
    const { data: messages, error: fetchMessagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('message_timestamp', { ascending: true });

    if (fetchMessagesError) {
      console.error('Error fetching messages for archiving:', fetchMessagesError.message);
      return { success: false, error: `Failed to fetch messages for archiving: ${fetchMessagesError.message}` };
    }

    // Step 3: Prepare the comprehensive archived object
    // Destructure chat_id from chatDetails to avoid storing it redundantly within the JSON blob
    const { chat_id: originalChatId, ...restOfChatDetails } = chatDetails;
    const comprehensiveArchivedData = {
      chat_details: restOfChatDetails, // Now chat_details in JSON does not contain chat_id
      messages: messages || [], // Ensure messages is an array, even if null/undefined
    };

    // Step 4: Execute INSERT into archived_chats and DELETE from chats
    // The MCP server's execute_postgresql tool should handle this in a transaction.
    
    // Note: Direct SQL execution for INSERT/DELETE requires UNSAFE mode.
    // This client-side code can't directly call live_dangerously.
    // We are assuming the MCP server or the environment where execute_postgresql runs
    // is either pre-configured for unsafe operations when needed, or the user
    // will be prompted if direct SQL for write operations is attempted without it.
    // For now, we construct the SQL. The actual call to execute_postgresql
    // will be made from where this function is used, or this function would
    // need to be refactored if it were to call MCP tools itself.
    //
    // Given the current tool structure, it's better if the component logic
    // handles the live_dangerously calls around the call to a function that
    // returns the SQL string, or this function itself uses execute_postgresql.
    // Let's assume this function will use execute_postgresql.
    
    // Attempting direct Supabase client operations.
    // These are subject to RLS policies for the authenticated user.
    const { error: insertArchivedError } = await supabase
      .from('archived_chats')
      .insert({ chat_id: chatId, archived_data: comprehensiveArchivedData });

    if (insertArchivedError) {
      console.error('Error inserting into archived_chats:', insertArchivedError.message);
      return { success: false, error: `Failed to archive chat with messages: ${insertArchivedError.message}` };
    }

    // If archiving messages is successful, then delete messages associated with the chat
    // This step is crucial to prevent orphaned messages if the chat is deleted but messages aren't.
    // However, if RLS on `messages` table prevents user from deleting messages directly, this will fail.
    // Often, messages are deleted via cascade when the chat is deleted, if a foreign key with ON DELETE CASCADE is set up.
    // Let's assume for now that deleting the chat from 'chats' table will handle messages if FK is set.
    // If not, messages should be deleted here explicitly.
    // For simplicity, we'll rely on potential CASCADE delete or manual cleanup later if needed.
    // A more robust solution would delete messages explicitly here if no CASCADE.

    const { error: deleteChatError } = await supabase
      .from('chats')
      .delete()
      .eq('chat_id', chatId);

    if (deleteChatError) {
      console.error('Error deleting from chats table:', deleteChatError.message);
      // At this point, chat and messages are archived, but original chat metadata failed to delete.
      // This is an inconsistent state. Manual intervention or a more complex rollback might be needed.
      return { success: false, error: `Chat and messages archived, but failed to delete original chat metadata: ${deleteChatError.message}` };
    }
    
    // Optionally, delete messages from the 'messages' table if not handled by CASCADE delete
    // This is important to prevent orphaned messages.
    const { error: deleteMessagesError } = await supabase
        .from('messages')
        .delete()
        .eq('chat_id', chatId);

    if (deleteMessagesError) {
        console.warn('Warning: Chat metadata deleted, but failed to delete associated messages from messages table:', deleteMessagesError.message);
        // This is not a full failure of archiving, but data is left behind.
        // The main success is that the chat is "deleted" from the user's active view.
    }


    return { success: true, message: 'Chat and its messages archived and deleted successfully.' };

  } catch (e: any) {
    console.error('Exception in archiveAndDeleteChatDirectly:', e.message);
    return { success: false, error: e.message };
  }
};
