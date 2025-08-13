import { useState, useCallback } from 'react';
import { Client, PrivateKey } from '@hiveio/dhive';
import * as SecureStore from 'expo-secure-store';
import { uploadImageSmart } from '../utils/imageUploadService';

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
  replyImage: string | null;
  replyGif: string | null;
  replyTarget: ReplyTarget | null;
  posting: boolean;
  uploading: boolean;
  processing: boolean; // New state for blockchain processing
  error: string | null;
}

interface UseReplyReturn extends ReplyState {
  openReplyModal: (target: ReplyTarget) => void;
  closeReplyModal: () => void;
  setReplyText: (text: string) => void;
  setReplyImage: (image: string | null) => void;
  setReplyGif: (gif: string | null) => void;
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
    replyImage: null,
    replyGif: null,
    replyTarget: null,
    posting: false,
    uploading: false,
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
      replyImage: null,
      replyGif: null,
      replyTarget: null,
      error: null,
    }));
  }, []);

  const setReplyText = useCallback((text: string) => {
    setState(prev => ({ ...prev, replyText: text }));
  }, []);

  const setReplyImage = useCallback((image: string | null) => {
    setState(prev => ({ ...prev, replyImage: image }));
  }, []);

  const setReplyGif = useCallback((gif: string | null) => {
    setState(prev => ({ ...prev, replyGif: gif }));
  }, []);

  const addImage = useCallback(async (mode: 'reply') => {
    if (mode !== 'reply') return;

    setState(prev => ({ ...prev, uploading: true }));

    try {
      const { launchImageLibraryAsync, MediaTypeOptions } = await import(
        'expo-image-picker'
      );

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
        setState(prev => ({ ...prev, replyImage: uploadResult.url }));
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
  }, []);

  const addGif = useCallback((gifUrl: string) => {
    setState(prev => ({ ...prev, replyGif: gifUrl }));
  }, []);

  const submitReply = useCallback(async () => {
    if (
      !state.replyTarget ||
      (!state.replyText.trim() && !state.replyImage && !state.replyGif) ||
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
      if (state.replyImage) {
        body += `\n![image](${state.replyImage})`;
      }
      if (state.replyGif) {
        body += `\n![gif](${state.replyGif})`;
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

      if (state.replyImage) {
        json_metadata.image = [state.replyImage];
      }
      if (state.replyGif) {
        if (!json_metadata.image) json_metadata.image = [];
        json_metadata.image.push(state.replyGif);
      }

      // Post to Hive blockchain
      await client.broadcast.comment(
        {
          parent_author,
          parent_permlink,
          author,
          permlink,
          title: '',
          body,
          json_metadata: JSON.stringify(json_metadata),
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
    state.replyImage,
    state.replyGif,
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
    setReplyImage,
    setReplyGif,
    submitReply,
    addImage,
    addGif,
    clearError,
  };
};
