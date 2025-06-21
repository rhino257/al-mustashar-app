import * as SecureStore from 'expo-secure-store';
import { SupportedStorage } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { Buffer } from 'buffer'; // Import Buffer for Base64 encoding/decoding

const ADAPTER_DEBUG = true; // Set to true to enable detailed logs

// Define a conservative chunk size. SecureStore has limits (e.g., 2KB on Android, 4KB on iOS).
// Base64 encoding increases size by ~33%, so adjust CHUNK_SIZE accordingly if storing Base64.
// Let's aim for raw data chunks to be around 1.5KB to give room for Base64 overhead.
const RAW_CHUNK_SIZE = Platform.OS === 'android' ? 1500 : 3000; // Raw data bytes
const CHUNK_COUNT_SUFFIX = '_chunk_count_v2'; // New suffix to avoid conflict with potentially old/bad chunks
const CHUNK_SUFFIX = '_chunk_v2_';

// Helper to convert Uint8Array to Base64 string
function uint8ArrayToBase64(array: Uint8Array): string {
  return Buffer.from(array).toString('base64');
}

// Helper to convert Base64 string to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

export const ExpoSecureStoreAdapter: SupportedStorage = {
  async getItem(key: string): Promise<string | null> {
    if (ADAPTER_DEBUG) console.log(`[SecureStoreAdapter][getItem] Attempting to get key: ${key}`);
    try {
      const chunkCountStr = await SecureStore.getItemAsync(key + CHUNK_COUNT_SUFFIX);
      if (!chunkCountStr) {
        if (ADAPTER_DEBUG) console.log(`[SecureStoreAdapter][getItem] No chunk count for ${key}, attempting direct read.`);
        const directValue = await SecureStore.getItemAsync(key);
        if (directValue) {
          if (ADAPTER_DEBUG) console.log(`[SecureStoreAdapter][getItem] Direct read for ${key} successful, length: ${directValue.length}. Decoding Base64.`);
          // Assume direct value is Base64 encoded if it was set by the new setItem logic for small items
          try {
            const decodedBytes = base64ToUint8Array(directValue);
            const finalStr = new TextDecoder().decode(decodedBytes);
            if (ADAPTER_DEBUG) console.log(`[SecureStoreAdapter][getItem] Decoded direct value for ${key}, final length: ${finalStr.length}, starts with: ${finalStr.substring(0,50)}`);
            return finalStr;
          } catch (decodeError) {
             if (ADAPTER_DEBUG) console.error(`[SecureStoreAdapter][getItem] Failed to decode Base64 for direct value of key ${key}:`, decodeError);
             // It might be a very old value not base64 encoded, or corrupted. Return as is or null.
             // For safety, if it's not valid base64 from our new scheme, treat as missing/corrupt.
             await SecureStore.deleteItemAsync(key); // Clean up potentially problematic direct item
             return null;
          }
        }
        if (ADAPTER_DEBUG) console.log(`[SecureStoreAdapter][getItem] No direct value found for ${key}.`);
        return null;
      }

      if (ADAPTER_DEBUG) console.log(`[SecureStoreAdapter][getItem] Found chunk count for ${key}: ${chunkCountStr}`);
      const chunkCount = parseInt(chunkCountStr, 10);
      if (isNaN(chunkCount) || chunkCount <= 0) {
        console.error('[SecureStoreAdapter][getItem] Invalid chunk count', chunkCountStr, 'for key:', key);
        await SecureStore.deleteItemAsync(key + CHUNK_COUNT_SUFFIX);
        return null;
      }

      const chunkPromises: Promise<string | null>[] = [];
      for (let i = 0; i < chunkCount; i++) {
        chunkPromises.push(SecureStore.getItemAsync(key + CHUNK_SUFFIX + i));
      }

      const base64Chunks = await Promise.all(chunkPromises);
      if (ADAPTER_DEBUG) console.log(`[SecureStoreAdapter][getItem] Retrieved ${base64Chunks.length} Base64 chunks for ${key}.`);
      const uint8ArrayChunks: Uint8Array[] = [];

      for (let i = 0; i < base64Chunks.length; i++) {
        const b64Chunk = base64Chunks[i];
        if (b64Chunk === null) {
          console.error(`[SecureStoreAdapter][getItem] Missing chunk ${i} for key ${key}. Cleaning up.`);
          await this.removeItem(key);
          return null;
        }
        uint8ArrayChunks.push(base64ToUint8Array(b64Chunk));
      }

      const totalLength = uint8ArrayChunks.reduce((acc, val) => acc + val.length, 0);
      const concatenatedBytes = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of uint8ArrayChunks) {
        concatenatedBytes.set(chunk, offset);
        offset += chunk.length;
      }

      const finalString = new TextDecoder().decode(concatenatedBytes);
      if (ADAPTER_DEBUG) console.log(`[SecureStoreAdapter][getItem] Successfully reassembled ${key}, final length: ${finalString.length}, starts with: ${finalString.substring(0, 50)}`);
      return finalString;

    } catch (error) {
      console.error(`[SecureStoreAdapter][getItem] Error for key ${key}:`, error);
      try {
        await this.removeItem(key);
      } catch (cleanupError) {
        console.error(`[SecureStoreAdapter][getItem] Cleanup error for key ${key}:`, cleanupError);
      }
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (ADAPTER_DEBUG) console.log(`[SecureStoreAdapter][setItem] Attempting to set key: ${key}, value length: ${value.length}`);
    try {
      const valueBytes = new TextEncoder().encode(value);
      if (ADAPTER_DEBUG) console.log(`[SecureStoreAdapter][setItem] Value for ${key} as bytes: ${valueBytes.length}`);

      // Cleanup logic from previous version (good to keep for transition)
      await SecureStore.deleteItemAsync(key);
      await SecureStore.deleteItemAsync(key + '_chunk_count'); // old suffix
      for(let i=0; ; i++) {
        const oldChunkKey = key + '_chunk_' + i;
        const item = await SecureStore.getItemAsync(oldChunkKey);
        if (item === null && i > 5) break;
        if (item !== null) await SecureStore.deleteItemAsync(oldChunkKey);
        if (i > 50) break;
      }

      if (valueBytes.length <= RAW_CHUNK_SIZE) {
        if (ADAPTER_DEBUG) console.log(`[SecureStoreAdapter][setItem] Storing ${key} as single Base64 item.`);
        await SecureStore.deleteItemAsync(key + CHUNK_COUNT_SUFFIX); // Ensure no new chunk count for single item
        const base64Value = uint8ArrayToBase64(valueBytes);
        if (ADAPTER_DEBUG) console.log(`[SecureStoreAdapter][setItem] Single item ${key} Base64 length: ${base64Value.length}`);
        await SecureStore.setItemAsync(key, base64Value, {
          keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
        });
        return;
      }

      const numChunks = Math.ceil(valueBytes.length / RAW_CHUNK_SIZE);
      if (ADAPTER_DEBUG) console.log(`[SecureStoreAdapter][setItem] Storing ${key} in ${numChunks} chunks.`);
      await SecureStore.setItemAsync(key + CHUNK_COUNT_SUFFIX, numChunks.toString(), {
        keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
      });

      const setChunkPromises: Promise<void>[] = [];
      for (let i = 0; i < numChunks; i++) {
        const chunkStart = i * RAW_CHUNK_SIZE;
        const chunkEnd = chunkStart + RAW_CHUNK_SIZE;
        const byteChunk = valueBytes.slice(chunkStart, chunkEnd);
        const base64Chunk = uint8ArrayToBase64(byteChunk);
        if (ADAPTER_DEBUG && i === 0) console.log(`[SecureStoreAdapter][setItem] Chunk 0 for ${key} (Base64) starts with: ${base64Chunk.substring(0,50)}`);
        setChunkPromises.push(
          SecureStore.setItemAsync(key + CHUNK_SUFFIX + i, base64Chunk, {
            keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
          })
        );
      }
      await Promise.all(setChunkPromises);
      if (ADAPTER_DEBUG) console.log(`[SecureStoreAdapter][setItem] Finished storing chunks for ${key}.`);

    } catch (error) {
      console.error(`[SecureStoreAdapter][setItem] Error for key ${key}:`, error);
    }
  },

  async removeItem(key: string): Promise<void> {
    if (ADAPTER_DEBUG) console.log(`[SecureStoreAdapter][removeItem] Attempting to remove key: ${key}`);
    try {
      const chunkCountStr = await SecureStore.getItemAsync(key + CHUNK_COUNT_SUFFIX);
      await SecureStore.deleteItemAsync(key + CHUNK_COUNT_SUFFIX); 

      if (chunkCountStr) {
        const chunkCount = parseInt(chunkCountStr, 10);
        if (ADAPTER_DEBUG) console.log(`[SecureStoreAdapter][removeItem] Found ${chunkCount} chunks for ${key} to remove.`);
        if (!isNaN(chunkCount) && chunkCount > 0) {
          const removeChunkPromises: Promise<void>[] = [];
          for (let i = 0; i < chunkCount; i++) {
            removeChunkPromises.push(SecureStore.deleteItemAsync(key + CHUNK_SUFFIX + i));
          }
          await Promise.all(removeChunkPromises);
        }
      }
      await SecureStore.deleteItemAsync(key); // Remove single/direct item
      if (ADAPTER_DEBUG) console.log(`[SecureStoreAdapter][removeItem] Removed direct key ${key} and any V2 chunks.`);

      // Cleanup old format
      await SecureStore.deleteItemAsync(key + '_chunk_count');
      for(let i=0; ; i++) {
        const oldChunkKey = key + '_chunk_' + i;
        const item = await SecureStore.getItemAsync(oldChunkKey);
        if (item === null && i > 5) break;
        if (item !== null) await SecureStore.deleteItemAsync(oldChunkKey);
        if (i > 50) break;
      }
      if (ADAPTER_DEBUG) console.log(`[SecureStoreAdapter][removeItem] Finished cleanup for ${key}.`);

    } catch (error) {
      console.error(`[SecureStoreAdapter][removeItem] Error for key ${key}:`, error);
    }
  },
};
