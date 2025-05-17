import { supabase } from './supabase'; // Adjust path
import EventSource from 'react-native-sse'; // Import EventSource from react-native-sse

// Define the base URL for your RAG API.
// This should ideally come from an environment variable.
const RAG_API_BASE_URL = process.env.EXPO_PUBLIC_RAG_API_URL || 'YOUR_RAG_BACKEND_BASE_URL_HERE';

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
      chat_id: payload.chat_id,
    });
    if (payload.ai_message_id) queryParams.append('ai_message_id', payload.ai_message_id);
    // Add pipeline_name if it's part of your payload and backend GET endpoint
    // if (payload.pipeline_name) queryParams.append('pipeline_name', payload.pipeline_name);

    const constructedUrl = `${RAG_API_BASE_URL}/rag/query?${queryParams.toString()}`;
    console.log('RAG Stream API [react-native-sse] - Connecting to URL:', constructedUrl);

    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource(constructedUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/event-stream', // Good practice
        },
      });
      console.log(new Date().toISOString(), '[RN Log Marker] SSE_Connection_Init');
        // You might need to check react-native-sse docs for how it handles retries or if specific polyfills are needed
        // For example, some might need a URL polyfill explicitly.
        // method: 'GET' // Usually default for EventSource
        // debug: true // Some libraries offer a debug mode


      console.log('RAG Stream API [react-native-sse] - EventSource instance created.');

      eventSource.addEventListener('open', (event) => { // Type for event might be Event or a custom type
        console.log('RAG Stream API [react-native-sse] - Connection opened.', event);
        // You might want to call onStreamEvent for 'open' if your UI needs it
      });
      // --- MODIFICATION START: Replaced generic 'message' listener with specific named event listeners ---
      const eventNames = ['metadata', 'stream_initiated', 'message_update', 'message_finalized'];

      eventNames.forEach(eventName => {
        if (eventSource) { // Check if eventSource is not null
          // CORRECTED LINE: Added 'as any' assertion for eventName
          eventSource.addEventListener(eventName as any, (event: any) => {
            console.log(new Date().toISOString(), `[RN Log Marker] SSE_Event_Received (Type: ${event.type}) - Data:`, event.data); // Modified Goal 5
            // event.type will be the specific eventName (e.g., 'metadata', 'message_finalized')

            // console.log(`RAG Stream API [react-native-sse] - Received named event. Type: '${event.type}', Data:`, event.data);

            if (!event.data && event.type !== 'open') { // 'open' events might not have data
              console.warn(`RAG Stream API [react-native-sse] - Event '${event.type}' received with no data.`);
              // For some events, no data might be acceptable.
              // If this event type *requires* data, you might call onStreamError or return.
              // For now, we'll allow it to pass through if onStreamEvent can handle it.
              // However, usually named events like message_update/finalized *will* have data.
              // Let's be stricter for common data-carrying events:
              if (event.type === 'message_update' || event.type === 'message_finalized' || event.type === 'metadata') {
                onStreamError(new Error(`Event '${event.type}' received with no data, which is unexpected.`));
                return;
              }
              // If it's an event type that might legitimately have no data, pass an empty object or handle appropriately.
              // onStreamEvent({ event: event.type, data: {} });
              // return;
            }

            let jsonData: any; // This will hold the processed data, ideally an object.

            // Primary Assumption: react-native-sse pre-parses valid JSON into objects.
            // event.data should be an object for JSON messages.
            // If the server sends a non-JSON string, event.data will be that string.

            if (typeof event.data === 'object' && event.data !== null) {
              // This is the expected path for JSON messages from the server.
              jsonData = event.data;
            } else if (typeof event.data === 'string') {
              // event.data is a string. It could be:
              // 1. A JSON string that react-native-sse didn't parse (less likely for named events).
              // 2. A non-JSON string sent by the server (e.g., plain text).
              // 3. The problematic string "[object Object]" if typeof was misleading.

              const eventDataString = event.data; // Keep a copy of the string

              // Attempt to parse it, in case it's a JSON string.
              // If eventDataString is literally "[object Object]", JSON.parse will fail.
              try {
                jsonData = JSON.parse(eventDataString);
              } catch (parseError) {
                // Parsing failed. The string was not valid JSON.
                // This could be an intentional non-JSON string from the server,
                // or it confirms eventDataString was like "[object Object]".
                console.warn(`REACT NATIVE: [${event.type}] Failed to parse event.data string as JSON. Error: ${parseError}. String was: "${eventDataString}".`);

                // IMPORTANT: If the string was "[object Object]", this indicates the
                // `typeof event.data === 'object'` check above *should have been true*.
                // This implies `event.data` might be an object that incorrectly stringifies
                // or `typeof` behaves unexpectedly in this environment for `event.data`.
                // If this is the case, the real object might still be accessible directly from `event.data`
                // if `event.data` was not the string `"[object Object]"` itself but an object that stringified to it.
                // However, if `eventDataString` *is* `"[object Object]"`, we can't recover the original object from this string.

                // For now, if a string payload for these named events cannot be parsed as JSON, treat it as an error,
                // as these events are expected to carry JSON objects.
                // If specific events *can* be plain strings and that's valid, this logic would need adjustment
                // to pass `eventDataString` directly to `onStreamEvent` for those cases.
                onStreamError(new Error(`Event '${event.type}' had string data that was not valid JSON: "${eventDataString}"`));
                return; // Stop processing this event.
              }
            } else if (event.data === null && event.type !== 'open') {
                // Explicitly handle null if it's not an 'open' event
                console.warn(`RAG Stream API [react-native-sse] - Event '${event.type}' received with null data.`);
                onStreamError(new Error(`Event '${event.type}' received with null data, which is unexpected.`));
                return;
            }
             else if (event.type === 'open' && !event.data) {
                // 'open' event often has no data, this is fine.
                console.log(`RAG Stream API [react-native-sse] - Event '${event.type}' received (no data, as expected for open).`);
                // Don't call onStreamEvent if there's no data and it's not expected for this event type
                return; // Or call onStreamEvent({ event: event.type, data: {} }); if the handler expects it
            }
            else {
              // Data is not an object, not a string (e.g., boolean, number).
              console.error(`REACT NATIVE: [${event.type}] event.data is of unexpected type: ${typeof event.data}. Data:`, event.data);
              onStreamError(new Error(`Event '${event.type}' has unexpected data type: ${typeof event.data}`));
              return; // Stop processing this event.
            }

            // At this point, jsonData should be the JavaScript object we need for further processing.
            // Ensure jsonData is not undefined before proceeding if some paths above might not assign it.
            if (typeof jsonData === 'undefined') {
                console.error(`REACT NATIVE: [${event.type}] jsonData is undefined after processing logic. This should not happen. Original event.data:`, event.data);
                onStreamError(new Error(`Internal error: jsonData undefined for event '${event.type}'`));
                return;
            }

            console.log(new Date().toISOString(), `[RN Log Marker] SSE_Callback_Called (Type: ${event.type})`); // Goal 6
            onStreamEvent({ event: event.type, data: jsonData });

            // Check specifically for message_finalized event and its data structure
            if (event.type === 'message_finalized' && typeof jsonData === 'object' && jsonData !== null && jsonData.isFinal === true) {
              console.log('RAG Stream API [react-native-sse] - Detected "message_finalized" with isFinal=true.');
              onStreamComplete();
              console.log('RAG Stream API [react-native-sse] - Attempting to close EventSource now due to message_finalized.');
              if (eventSource) { // Ensure eventSource is still valid
                eventSource.close();
              }
            }
          });
        }
      });
      // --- MODIFICATION END ---

      eventSource.addEventListener('error', (error: any) => {
        // Typecast to 'any' or a more specific error type if available from react-native-sse
        const errorEvent = error as any;
        console.error(`REACT NATIVE: SSE Error AT: ${new Date().toISOString()}`, errorEvent);
        // Potentially log errorEvent.message or other properties if they exist
        // Close and nullify EventSource if error is fatal
        // eventSource.close();
        // setEventSourceInstance(null);
        // setBotMessageStream(prev => ({ ...prev, loading: false, text: prev.text || "Error connecting." }));

        let errorMessage = "SSE connection error.";
        if (errorEvent && errorEvent.message) {
          errorMessage = errorEvent.message;
        } else if (errorEvent) {
          // Try to get more details based on react-native-sse error event structure
          // For example, event.type, event.status if it's an HTTP error object
          errorMessage = `SSE Error: type=${errorEvent.type}, status=${errorEvent.status}, message=${JSON.stringify(errorEvent)}`;
        }

        onStreamError(new Error(errorMessage));
        onStreamComplete(); // Stream is over due to error
        eventSource?.close();
      });

      return () => {
        console.log('RAG Stream API [react-native-sse] - Cleanup: Closing EventSource.');
        eventSource?.close();
        // It might be good to call onStreamComplete() here too if it hasn't been called,
        // to ensure any UI spinners etc. are stopped.
        // However, if already called by 'message_finalized' or 'error', calling again might be redundant
        // or handled by the component's state logic.
      };

    } catch (error) {
      console.error('RAG Stream API [react-native-sse] - Error creating EventSource instance:', error);
      onStreamError(error as Error);
      onStreamComplete();
      return () => {};
    }
  } catch (authError: any) {
      console.error('RAG Stream API [react-native-sse] - Authentication Error:', authError);
      onStreamError(authError);
      onStreamComplete();
      return () => {}; // Return a no-op closer
  }
};
