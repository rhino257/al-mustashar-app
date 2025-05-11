import { supabase } from './supabase'; // Adjust path

// Define the base URL for your RAG API.
// This should ideally come from an environment variable.
const RAG_API_BASE_URL = process.env.EXPO_PUBLIC_RAG_API_URL || 'YOUR_RAG_BACKEND_BASE_URL_HERE';
// TODO: Ensure EXPO_PUBLIC_RAG_API_URL is set in your .env file

interface RagQueryPayload {
  query: string;
  chat_id: string;
  ai_message_id?: string | null;
  files?: Array<{
    file_name: string;
    mime_type: string;
    storage_path: string;
    size_bytes: number;
  }>;
}

// Keep callRagApiTest for non-streaming tests if useful, or remove if streamRagQuery supersedes it.
// export const callRagApiTest = async (payload: RagQueryPayload): Promise<any> => { ... };


export interface StreamEvent { // Define a type for parsed SSE events
  event?: string; // e.g., 'metadata', 'message_update'
  data: any;    // Parsed JSON data from the event
}

export const streamRagQuery = async (
  payload: RagQueryPayload,
  onStreamEvent: (event: StreamEvent) => void, // Callback for each parsed event
  onStreamError: (error: Error) => void,     // Callback for stream errors
  onStreamComplete: () => void               // Callback for when stream naturally completes
): Promise<void> => { // This function will manage the stream lifecycle
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      // If onStreamError is defined, use it, otherwise throw
      if (typeof onStreamError === 'function') {
        onStreamError(new Error('User not authenticated for RAG API call.'));
        return; // Exit if onStreamError is called and handles it
      } else {
        throw new Error('User not authenticated for RAG API call.');
      }
    }
    const token = session.access_token;

    // Encode payload as URL query parameters for GET request
    const params = new URLSearchParams();
    params.append('query', payload.query);
    params.append('chat_id', payload.chat_id);
    if (payload.ai_message_id) {
      params.append('ai_message_id', payload.ai_message_id);
    }
    // Add pipeline_name if it's part of your payload and backend GET endpoint
    // if (payload.pipeline_name) { // Assuming pipeline_name might be in payload
    //   params.append('pipeline_name', payload.pipeline_name);
    // }

    const constructedUrl = `${RAG_API_BASE_URL}/rag/query?${params.toString()}`;
    console.log(`[STREAM RAG QUERY - GET] URL: ${constructedUrl}`); // Log the GET URL

    const response = await fetch(constructedUrl, {
      method: 'GET', // Use GET method
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'text/event-stream', // Important: tell server we expect SSE
        // NO 'Content-Type': 'application/json' here for GET
      },
      // NO body here for GET
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ detail: `HTTP error! status: ${response.status}` }));
      throw new Error(errorBody.detail || `HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Response body is null, cannot process stream.');
    }

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        // Process any remaining buffer before breaking
        if (buffer.trim().length > 0) {
            // This case should ideally not happen if backend correctly ends messages with \n\n
            console.warn("Stream ended with unprocessed buffer:", buffer);
        }
        break;
      }

      buffer += value;
      let eventSeparatorIndex;

      // Process all complete events in the buffer
      // An event is typically event: <name>\ndata: <json>\n\n
      while ((eventSeparatorIndex = buffer.indexOf('\n\n')) !== -1) {
        const eventString = buffer.substring(0, eventSeparatorIndex);
        buffer = buffer.substring(eventSeparatorIndex + 2); // +2 for \n\n

        if (eventString.trim().length === 0) continue; // Skip empty keep-alive messages

        let eventName: string | undefined;
        let eventDataString: string | undefined;

        const lines = eventString.split('\n');
        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventName = line.substring('event:'.length).trim();
          } else if (line.startsWith('data:')) {
            eventDataString = line.substring('data:'.length).trim();
          }
          // Ignore other lines like 'id:' or comments ':'
        }

        if (eventDataString) {
          try {
            const jsonData = JSON.parse(eventDataString);
            onStreamEvent({ event: eventName, data: jsonData });

            // Check for the specific end-of-stream event from your backend
            if (eventName === 'message_finalized' && jsonData.isFinal === true) {
                // This is the RAG backend's explicit end signal
                // The while loop will break on next 'done' from reader.read()
                // or we could call reader.cancel() here if appropriate,
                // but letting it finish naturally is usually fine.
            }

          } catch (e) {
            console.error('Failed to parse SSE event data JSON:', eventDataString, e);
            // Potentially call onStreamError or just log
          }
        }
      }
    }
    onStreamComplete();

  } catch (error: any) {
    console.error('RAG Streaming Error:', error);
    // If onStreamError is defined, pass the error to it
    if (typeof onStreamError === 'function') {
      onStreamError(error);
    } else {
      // If onStreamError is not provided, and an error occurs, it might be unhandled by calling code.
      console.error('onStreamError callback not provided or not a function. Error will not be propagated via callback.');
    }
  }
};
