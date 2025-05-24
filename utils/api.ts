import { supabase } from './supabase'; // Adjust path
import EventSource from 'react-native-sse'; // Import EventSource from react-native-sse

// Define the base URL for your RAG API.
// This should ideally come from an environment variable.
const RAG_API_BASE_URL = process.env.EXPO_PUBLIC_RAG_API_URL;

if (!RAG_API_BASE_URL) {
  // For production, EXPO_PUBLIC_RAG_API_URL should always be set via EAS Secrets.
  // In a development environment, you might want to log a warning or use a default.
  // Throwing an error ensures it's not missed if the env var is not set.
  console.error("CRITICAL: EXPO_PUBLIC_RAG_API_URL is not defined. This must be set in EAS Secrets for production.");
  // Consider throwing new Error("CRITICAL: EXPO_PUBLIC_RAG_API_URL is not defined.") if the app cannot function without it.
}

interface RagQueryPayload {
  query: string;
  chat_id: string;
  user_id: string; // Added for MemoryManager
  use_reranker?: boolean; // Added for reranker
  ai_message_id?: string | null;
  files?: Array<{
    file_name: string;
    mime_type: string;
    storage_path: string;
    size_bytes: number;
  }>;
}

export interface StreamEvent { // Define a type for parsed SSE events
  event?: string; // e.g., 'metadata', 'message_update'
  data: any;    // Parsed JSON data from the event
}

export const streamRagQuery = async (
  payload: RagQueryPayload,
  onStreamEvent: (event: StreamEvent) => void, // Callback for each parsed event
  onStreamError: (error: Error) => void,     // Callback for stream errors
  onStreamComplete: () => void               // Callback for when stream naturally completes
): Promise<() => void> => { // Return a function to close the EventSource
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      onStreamError(new Error('User not authenticated for RAG API call.'));
      return () => {}; // Return a no-op closer
    }
    const token = session.access_token;

    const queryParams = new URLSearchParams({
        query: payload.query,
        chat_id: payload.chat_id, // This is always present as per previous discussions
    });

    // Add ai_message_id if present (current logic, assuming it's NOT sent based on last confirmation)
    if (payload.ai_message_id) { // If you are indeed not sending this, this block can be removed or commented.
        queryParams.append('ai_message_id', payload.ai_message_id);
    }

    // Add pipeline_name (always default for now)
    const pipelineName = "default"; // Or from payload if it becomes dynamic
    queryParams.append('pipeline_name', pipelineName);

    // Add use_reranker if explicitly true
    if (payload.use_reranker === true) {
        queryParams.append('use_reranker', 'true');
    }

    const constructedUrl = `${RAG_API_BASE_URL}/rag/query?${queryParams.toString()}`;

    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource(constructedUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/event-stream', // Good practice
        },
      });
        // You might need to check react-native-sse docs for how it handles retries or if specific polyfills are needed
        // For example, some might need a URL polyfill explicitly.
        // method: 'GET' // Usually default for EventSource
        // debug: true // Some libraries offer a debug mode


      eventSource.addEventListener('open', (event) => {
        // No need to call onStreamEvent for 'open' unless the UI specifically needs it.
      });

      const eventNames = ['metadata', 'stream_initiated', 'message_update', 'message_finalized', 'tool_info'];

      eventNames.forEach(eventName => {
        if (eventSource) {
          eventSource.addEventListener(eventName as any, (event: any) => {
            // react-native-sse is expected to parse JSON data into event.data

            // Pass the parsed data directly to the handler
            onStreamEvent({ event: event.type, data: event.data });

            // Check specifically for message_finalized event and its data structure
            if (event.type === 'message_finalized' && event.data && event.data.isFinal === true) {
              onStreamComplete();
              if (eventSource) {
                eventSource.close();
              }
            }
          });
        }
      });

      eventSource.addEventListener('error', (error: any) => {
        let errorMessage = "SSE connection error.";
        let errorDetails = error; // Keep the original error object

        // Attempt to parse {"detail": "Error message"} for initial HTTP errors
        // The structure of the error object from react-native-sse on initial HTTP errors
        // might vary. Common patterns include error.response.data or error.data.
        // We'll make an educated guess based on typical fetch/axios error structures,
        // but this might need runtime verification.
        if (error && typeof error === 'object') {
            if (error.message) {
                errorMessage = `SSE Error: ${error.message}`;
            }
            // Check for {"detail": "..."} in common places
            if (error.response && error.response.data && error.response.data.detail) {
                errorMessage = `SSE HTTP Error: ${error.response.data.detail}`;
                errorDetails = error.response.data; // Use the parsed detail as error details
            } else if (error.data && error.data.detail) {
                 errorMessage = `SSE HTTP Error: ${error.data.detail}`;
                 errorDetails = error.data; // Use the parsed detail as error details
            } else if (error.status) {
                 // If status is available but no detail, provide status
                 errorMessage = `SSE HTTP Error: Status ${error.status}`;
            }
        } else if (typeof error === 'string') {
            errorMessage = `SSE Error: ${error}`;
        }


        onStreamError(new Error(errorMessage)); // Pass a standard Error object
        onStreamComplete(); // Stream is over due to error
        eventSource?.close();
      });

      // Add listener for the 'close' event as a fallback for completion
      eventSource.addEventListener('close', () => {
        // Call onStreamComplete as a fallback if it hasn't been called already
        // The onStreamComplete function in ChatPage handles clearing the ref,
        // so calling it multiple times should be safe if the ref check is done there.
        onStreamComplete();
      });

      return () => {
        eventSource?.close();
        // It might be good to call onStreamComplete() here too if it hasn't been called,
        // to ensure any UI spinners etc. are stopped.
        // However, if already called by 'message_finalized' or 'error', calling again might be redundant
        // or handled by the component's state logic.
      };

    } catch (error) {
      onStreamError(error as Error);
      onStreamComplete();
      return () => {};
    }
  } catch (authError: any) {
      onStreamError(authError);
      onStreamComplete();
      return () => {}; // Return a no-op closer
  }
};
