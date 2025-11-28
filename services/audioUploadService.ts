/**
 * Audio Upload Service for 3Speak Audio API
 * Handles uploading audio recordings to IPFS via audio.3speak.tv
 */

import * as FileSystem from 'expo-file-system/legacy';
import { THREE_SPEAK_API_KEY } from '../app/config/env';

export interface AudioUploadOptions {
  title?: string;
  description?: string;
}

export interface AudioUploadResult {
  success: boolean;
  permlink: string;
  cid: string;
  playUrl: string;
  apiUrl: string;
  error?: string;
}

const AUDIO_API_BASE = 'https://audio.3speak.tv';
const MAX_AUDIO_FILE_BYTES = 50 * 1024 * 1024; // 50MB limit

/**
 * Get audio duration from file URI
 * For now, this would need to be passed in, but in real implementation
 * we could use expo-av or similar to extract duration
 */
export function calculateAudioDuration(durationMs: number): number {
  return Math.ceil(durationMs / 1000);
}

/**
 * Upload audio blob to 3Speak Audio API
 * @param audioBlob - The audio blob to upload
 * @param durationSeconds - Duration of the audio in seconds
 * @param username - Hive username uploading the audio
 * @param options - Optional metadata (title, description)
 * @returns Upload result with permlink and playUrl
 */
export async function uploadAudioTo3Speak(
  audioBlob: Blob,
  durationSeconds: number,
  username: string,
  options: AudioUploadOptions = {}
): Promise<AudioUploadResult> {
  try {
    // Validate file size
    if (audioBlob.size > MAX_AUDIO_FILE_BYTES) {
      return {
        success: false,
        permlink: '',
        cid: '',
        playUrl: '',
        apiUrl: '',
        error: `Audio file is too large (${(audioBlob.size / (1024 * 1024)).toFixed(1)} MB). Maximum file size is 50 MB.`,
      };
    }

    // Validate duration
    if (durationSeconds <= 0) {
      return {
        success: false,
        permlink: '',
        cid: '',
        playUrl: '',
        apiUrl: '',
        error: 'Invalid audio duration',
      };
    }

    // Create FormData for multipart upload
    const formData = new FormData();

    // Append audio blob
    formData.append('audio', audioBlob, `audio-${Date.now()}.webm`);
    formData.append('duration', durationSeconds.toString());
    formData.append('format', 'webm');

    // Append optional metadata
    if (options.title) {
      formData.append('title', options.title);
    }
    if (options.description) {
      formData.append('description', options.description);
    }

    // Upload to 3Speak Audio API
    const response = await fetch(`${AUDIO_API_BASE}/api/audio/upload`, {
      method: 'POST',
      headers: {
        'X-API-Key': THREE_SPEAK_API_KEY,
        'X-User': username,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message ||
        errorData.error ||
        `Upload failed with status ${response.status}`;

      return {
        success: false,
        permlink: '',
        cid: '',
        playUrl: '',
        apiUrl: '',
        error: errorMessage,
      };
    }

    const result = await response.json();

    return {
      success: true,
      permlink: result.permlink,
      cid: result.cid,
      playUrl: result.playUrl,
      apiUrl: result.apiUrl,
    };
  } catch (error: any) {
    console.error('Audio upload error:', error);
    return {
      success: false,
      permlink: '',
      cid: '',
      playUrl: '',
      apiUrl: '',
      error: error.message || 'Failed to upload audio',
    };
  }
}

/**
 * Extract audio permlink from 3Speak audio URL
 * Handles formats like: https://audio.3speak.tv/play?a=w2ehm8pr
 */
export function extractAudioPermlink(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.get('a');
  } catch {
    return null;
  }
}

/**
 * Generate audio embed URL for iFrame display
 * Uses minimal mode with iframe=1 for clean embedding
 * @param permlink - Audio permlink from upload
 * @returns iFrame src URL
 */
export function generateAudioEmbedUrl(permlink: string): string {
  return `${AUDIO_API_BASE}/play?a=${permlink}&mode=minimal&iframe=1`;
}
