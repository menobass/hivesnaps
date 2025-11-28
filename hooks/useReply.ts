import { useState, useCallback } from 'react';
import { Client, PrivateKey } from '@hiveio/dhive';
import * as SecureStore from 'expo-secure-store';
import { uploadImageSmart } from '../utils/imageUploadService';
import { uploadAudioTo3Speak } from '../services/audioUploadService';
import { postSnapWithBeneficiaries } from '../services/snapPostingService';
import * as ImagePicker from 'expo-image-picker';

const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];
const client = new Client(HIVE_NODES);

export interface ReplyTarget {
  author: string;
  permlink: string;
}

interface ReplyState {
  replyModalVisible: boolean;
  replyText: string;
  replyImages: string[]; // Changed to array
  replyGifs: string[]; // Changed to array
  replyAudioUrl: string | null; // Audio embed URL from 3Speak
  replyTarget: ReplyTarget | null;
  posting: boolean;
  uploading: boolean;
  audioUploading: boolean; // Separate state for audio upload
  processing: boolean; // New state for blockchain processing
  error: string | null;
}

interface UseReplyReturn extends ReplyState {
  openReplyModal: (target: ReplyTarget) => void;
  closeReplyModal: () => void;
  setReplyText: (text: string) => void;
  setReplyImages: (images: string[]) => void;
  setReplyGifs: (gifs: string[]) => void;
  addReplyImage: (imageUrl: string) => void;
  removeReplyImage: (imageUrl: string) => void;
  addReplyGif: (gifUrl: string) => void;
  removeReplyGif: (gifUrl: string) => void;
  addReplyAudio: (audioUrl: string) => void;
  removeReplyAudio: () => void;
  handleAudioRecorded: (audioBlob: Blob, durationSeconds: number) => Promise<void>;
  submitReply: () => Promise<void>;
  addImage: (mode: 'reply') => Promise<void>;
  addGif: (gifUrl: string) => void;
  clearError: () => void;
}

export const useReply = (
  currentUsername: string | null,
  onRefresh?: () => Promise<boolean>,
  onSubmissionStart?: () => void
): UseReplyReturn => {
  const [state, setState] = useState<ReplyState>({
    replyModalVisible: false,
    replyText: '',
    replyImages: [], // Changed to array
    replyGifs: [], // Changed to array
    replyAudioUrl: null,
    replyTarget: null,
    posting: false,
    uploading: false,
    audioUploading: false,
    processing: false,
    error: null,
  });

  const openReplyModal = useCallback((target: ReplyTarget) => {
    setState(prev => ({
      ...prev,
      replyTarget: target,
      replyModalVisible: true,
    }));
  }, []);

  const closeReplyModal = useCallback(() => {
    setState(prev => ({
      ...prev,
      replyModalVisible: false,
      replyText: '',
      replyImages: [], // Changed to array
      replyGifs: [], // Changed to array
      replyAudioUrl: null,
      replyTarget: null,
      error: null,
    }));
  }, []);

  const setReplyText = useCallback((text: string) => {
    setState(prev => ({ ...prev, replyText: text }));
  }, []);

  const setReplyImages = useCallback((images: string[]) => {
    setState(prev => ({ ...prev, replyImages: images }));
  }, []);

  const setReplyGifs = useCallback((gifs: string[]) => {
    setState(prev => ({ ...prev, replyGifs: gifs }));
  }, []);

  const addReplyImage = useCallback((imageUrl: string) => {
    setState(prev => ({ ...prev, replyImages: [...prev.replyImages, imageUrl] }));
  }, []);

  const removeReplyImage = useCallback((imageUrl: string) => {
    setState(prev => ({ 
      ...prev, 
      replyImages: prev.replyImages.filter(img => img !== imageUrl) 
    }));
  }, []);

  const addReplyGif = useCallback((gifUrl: string) => {
    setState(prev => ({ ...prev, replyGifs: [...prev.replyGifs, gifUrl] }));
  }, []);

  const removeReplyGif = useCallback((gifUrl: string) => {
    setState(prev => ({ 
      ...prev, 
      replyGifs: prev.replyGifs.filter(gif => gif !== gifUrl) 
    }));
  }, []);

  const addReplyAudio = useCallback((audioUrl: string) => {
    setState(prev => ({ ...prev, replyAudioUrl: audioUrl }));
  }, []);

  const removeReplyAudio = useCallback(() => {
    setState(prev => ({ ...prev, replyAudioUrl: null }));
  }, []);

  const handleAudioRecorded = useCallback(async (audioBlob: Blob, durationSeconds: number) => {
    setState(prev => ({ ...prev, audioUploading: true, error: null }));

    try {
      if (!currentUsername) {
        throw new Error('Not logged in');
      }

      const result = await uploadAudioTo3Speak(
        audioBlob,
        durationSeconds,
        currentUsername,
        {
          title: `Audio Reply by ${currentUsername}`,
        }
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to upload audio');
      }

      addReplyAudio(result.playUrl);
    } catch (error: any) {
      console.error('Error uploading reply audio:', error);
      setState(prev => ({
        ...prev,
        error: error.message || 'Failed to upload audio',
      }));
    } finally {
      setState(prev => ({ ...prev, audioUploading: false }));
    }
  }, [currentUsername]);

  const addImage = useCallback(async (mode: 'reply') => {
    if (mode !== 'reply') return;

    setState(prev => ({ ...prev, uploading: true }));

    try {
      // Use static import for ImagePicker
      const { launchImageLibraryAsync, MediaTypeOptions } = ImagePicker;

      const result = await launchImageLibraryAsync({
        mediaTypes: MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];

        const fileToUpload = {
          uri: asset.uri,
          name: `reply-${Date.now()}.jpg`,
          type: 'image/jpeg',
        };

        const uploadResult = await uploadImageSmart(fileToUpload, currentUsername);
        console.log(`[useReply] Image uploaded via ${uploadResult.provider} (cost: $${uploadResult.cost})`);
        
        // Add to array instead of replacing
        setState(prev => ({ 
          ...prev, 
          replyImages: [...prev.replyImages, uploadResult.url] 
        }));
      }
    } catch (error) {
      console.error('Image upload error:', error);
      setState(prev => ({
        ...prev,
        error:
          error instanceof Error ? error.message : 'Failed to upload image',
      }));
    } finally {
      setState(prev => ({ ...prev, uploading: false }));
    }
  }, [currentUsername]);

  const addGif = useCallback((gifUrl: string) => {
    setState(prev => ({ ...prev, replyGifs: [...prev.replyGifs, gifUrl] }));
  }, []);

  const submitReply = useCallback(async () => {
    if (
      !state.replyTarget ||
      (!state.replyText.trim() && state.replyImages.length === 0 && state.replyGifs.length === 0 && !state.replyAudioUrl) ||
      !currentUsername
    ) {
      return;
    }

    setState(prev => ({ ...prev, posting: true, error: null }));

    try {
      // Get posting key from secure storage
      const postingKeyStr = await SecureStore.getItemAsync('hive_posting_key');
      if (!postingKeyStr) {
        throw new Error('No posting key found. Please log in again.');
      }
      const postingKey = PrivateKey.fromString(postingKeyStr);

      let body = state.replyText.trim();
      
      // Add all images
      state.replyImages.forEach(imageUrl => {
        body += `\n![image](${imageUrl})`;
      });
      
      // Add all GIFs
      state.replyGifs.forEach(gifUrl => {
        body += `\n![gif](${gifUrl})`;
      });

      // Add audio URL (without markdown link, just the embed URL)
      if (state.replyAudioUrl) {
        body += `\n${state.replyAudioUrl}`;
      }

      const parent_author = state.replyTarget.author;
      const parent_permlink = state.replyTarget.permlink;
      const author = currentUsername;

      // Sanitize parent_author for use in permlink
      const sanitizedParentAuthor = parent_author
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '');
      const permlink = `re-${sanitizedParentAuthor}-${parent_permlink}-${Date.now()}`;

      const json_metadata: any = {
        app: 'hivesnaps/1.0',
        format: 'markdown',
        tags: ['hivesnaps', 'reply'],
      };

      // Add all images and GIFs to metadata
      const allMedia = [...state.replyImages, ...state.replyGifs];
      if (allMedia.length > 0) {
        json_metadata.image = allMedia;
      }

      // Add audio to metadata if present
      if (state.replyAudioUrl) {
        json_metadata.audio = { platform: '3speak', url: state.replyAudioUrl };
      }

      // Use postSnapWithBeneficiaries to handle audio beneficiaries (5% to @snapie)
      await postSnapWithBeneficiaries(
        client,
        {
          parentAuthor: parent_author,
          parentPermlink: parent_permlink,
          author,
          permlink,
          title: '',
          body,
          jsonMetadata: JSON.stringify(json_metadata),
          hasAudio: !!state.replyAudioUrl,
        },
        postingKey
      );

      // Close modal and reset state
      closeReplyModal();

      // Set processing state to true (keep posting true until we confirm success or timeout)
      setState(prev => ({ ...prev, processing: true }));

      // Notify that submission has started
      onSubmissionStart?.();

      // Add delay to account for Hive blockchain block time (3 seconds)
      setTimeout(() => {
        // Poll for new content every second for up to 4 retries
        let retryCount = 0;
        const maxRetries = 4;

        const pollForContent = () => {
          console.log(`Polling attempt ${retryCount + 1}/${maxRetries}`);
          onRefresh?.().then(contentFound => {
            if (contentFound) {
              console.log('Content found, stopping polling early');
              setState(prev => ({
                ...prev,
                processing: false,
                posting: false,
              })); // Clear both states
              return;
            }
            retryCount++;

            if (retryCount < maxRetries) {
              console.log(`Content not found, polling again in 1 second...`);
              setTimeout(pollForContent, 1000); // Poll again in 1 second
            } else {
              console.log('Max retries reached, stopping polling');
              setState(prev => ({
                ...prev,
                processing: false,
                posting: false,
              })); // Clear both states after timeout
            }
          });
        };

        pollForContent(); // Start polling
      }, 3000);
    } catch (error) {
      console.error('Reply submission error:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to post reply',
        posting: false,
      }));
    }
  }, [
    state.replyTarget,
    state.replyText,
    state.replyImages,
    state.replyGifs,
    state.replyAudioUrl,
    currentUsername,
    closeReplyModal,
    onRefresh,
    onSubmissionStart,
  ]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    openReplyModal,
    closeReplyModal,
    setReplyText,
    setReplyImages,
    setReplyGifs,
    addReplyImage,
    removeReplyImage,
    addReplyGif,
    removeReplyGif,
    addReplyAudio,
    removeReplyAudio,
    handleAudioRecorded,
    submitReply,
    addImage,
    addGif,
    clearError,
  };
};
