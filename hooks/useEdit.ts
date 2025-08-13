import { useState, useCallback } from 'react';
import { Client, PrivateKey } from '@hiveio/dhive';
import * as SecureStore from 'expo-secure-store';
import { uploadImageSmart } from '../utils/imageUploadService';
import { stripImageTags, getFirstImageUrl } from '../utils/extractImageInfo';

const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];
const client = new Client(HIVE_NODES);

export interface EditTarget {
  author: string;
  permlink: string;
  type: 'snap' | 'reply';
}

interface EditState {
  editModalVisible: boolean;
  editText: string;
  editImage: string | null;
  editGif: string | null;
  editTarget: EditTarget | null;
  editing: boolean;
  uploading: boolean;
  processing: boolean; // New state for blockchain processing
  error: string | null;
}

interface UseEditReturn extends EditState {
  openEditModal: (target: EditTarget, currentBody: string) => void;
  closeEditModal: () => void;
  setEditText: (text: string) => void;
  setEditImage: (image: string | null) => void;
  setEditGif: (gif: string | null) => void;
  submitEdit: () => Promise<void>;
  addImage: (mode: 'edit') => Promise<void>;
  addGif: (gifUrl: string) => void;
  clearError: () => void;
}

export const useEdit = (
  currentUsername: string | null,
  onRefresh?: () => Promise<boolean>,
  onSubmissionStart?: () => void
): UseEditReturn => {
  const [state, setState] = useState<EditState>({
    editModalVisible: false,
    editText: '',
    editImage: null,
    editGif: null,
    editTarget: null,
    editing: false,
    uploading: false,
    processing: false, // Initialize new state
    error: null,
  });

  const openEditModal = useCallback(
    (target: EditTarget, currentBody: string) => {
      const textBody = stripImageTags(currentBody);
      const existingImageUrl = getFirstImageUrl(currentBody);

      setState(prev => ({
        ...prev,
        editTarget: target,
        editText: textBody,
        editImage: existingImageUrl,
        editGif: null,
        editModalVisible: true,
        error: null,
      }));
    },
    []
  );

  const closeEditModal = useCallback(() => {
    setState(prev => ({
      ...prev,
      editModalVisible: false,
      editText: '',
      editImage: null,
      editGif: null,
      editTarget: null,
      error: null,
    }));
  }, []);

  const setEditText = useCallback((text: string) => {
    setState(prev => ({ ...prev, editText: text }));
  }, []);

  const setEditImage = useCallback((image: string | null) => {
    setState(prev => ({ ...prev, editImage: image }));
  }, []);

  const setEditGif = useCallback((gif: string | null) => {
    setState(prev => ({ ...prev, editGif: gif }));
  }, []);

  const addImage = useCallback(async (mode: 'edit') => {
    if (mode !== 'edit') return;

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
          name: `edit-${Date.now()}.jpg`,
          type: 'image/jpeg',
        };

        const uploadResult = await uploadImageSmart(fileToUpload, currentUsername);
        console.log(`[useEdit] Image uploaded via ${uploadResult.provider} (cost: $${uploadResult.cost})`);
        setState(prev => ({ ...prev, editImage: uploadResult.url }));
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
    setState(prev => ({ ...prev, editGif: gifUrl }));
  }, []);

  const submitEdit = useCallback(async () => {
    if (
      !state.editTarget ||
      (!state.editText.trim() && !state.editImage && !state.editGif) ||
      !currentUsername
    ) {
      return;
    }

    setState(prev => ({ ...prev, editing: true, error: null }));

    try {
      // Get posting key from secure storage
      const postingKeyStr = await SecureStore.getItemAsync('hive_posting_key');
      if (!postingKeyStr) {
        throw new Error('No posting key found. Please log in again.');
      }
      const postingKey = PrivateKey.fromString(postingKeyStr);

      let body = state.editText.trim();
      if (state.editImage) {
        body += `\n![image](${state.editImage})`;
      }
      if (state.editGif) {
        body += `\n![gif](${state.editGif})`;
      }

      // Get the original post to preserve parent relationships
      const originalPost = await client.database.call('get_content', [
        state.editTarget.author,
        state.editTarget.permlink,
      ]);

      // Parse existing metadata and add edited flag
      let existingMetadata: any = {};
      try {
        if (originalPost.json_metadata) {
          existingMetadata = JSON.parse(originalPost.json_metadata);
        }
      } catch (e) {
        // Invalid JSON, start fresh
      }

      const json_metadata = {
        ...existingMetadata,
        app: 'hivesnaps/1.0',
        format: 'markdown',
        edited: true,
        edit_timestamp: new Date().toISOString(),
      };

      if (state.editImage && !json_metadata.image) {
        json_metadata.image = [state.editImage];
      }
      if (state.editGif) {
        if (!json_metadata.image) json_metadata.image = [];
        json_metadata.image.push(state.editGif);
      }

      // Edit the post/reply using same author/permlink with new content
      await client.broadcast.comment(
        {
          parent_author: originalPost.parent_author, // Keep original parent
          parent_permlink: originalPost.parent_permlink, // Keep original parent permlink
          author: currentUsername,
          permlink: state.editTarget.permlink,
          title: originalPost.title || '', // Keep original title
          body,
          json_metadata: JSON.stringify(json_metadata),
        },
        postingKey
      );

      // Close modal and reset state
      closeEditModal();

      // Set processing state to true (keep editing true until we confirm success or timeout)
      setState(prev => ({ ...prev, processing: true }));

      // Notify that submission has started
      onSubmissionStart?.();

      // Add delay to account for Hive blockchain block time (3 seconds)
      setTimeout(() => {
        // Poll for new content every second for up to 4 retries
        let retryCount = 0;
        const maxRetries = 4;

        const pollForContent = () => {
          console.log(`Edit polling attempt ${retryCount + 1}/${maxRetries}`);
          onRefresh?.().then(found => {
            if (found) {
              console.log('Edited content found, stopping polling early');
              setState(prev => ({
                ...prev,
                processing: false,
                editing: false,
              })); // Clear both states
              return;
            }
            retryCount++;
            if (retryCount < maxRetries) {
              console.log(
                `Edited content not found, polling again in 1 second...`
              );
              setTimeout(pollForContent, 1000); // Poll again in 1 second
            } else {
              console.log('Max retries reached, stopping edit polling');
              setState(prev => ({
                ...prev,
                processing: false,
                editing: false,
              })); // Clear both states after timeout
            }
          });
        };

        pollForContent(); // Start polling
      }, 3000);
    } catch (error) {
      console.error('Edit submission error:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to edit post',
        editing: false,
      }));
    }
  }, [
    state.editTarget,
    state.editText,
    state.editImage,
    state.editGif,
    currentUsername,
    closeEditModal,
    onRefresh,
    onSubmissionStart,
  ]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    openEditModal,
    closeEditModal,
    setEditText,
    setEditImage,
    setEditGif,
    submitEdit,
    addImage,
    addGif,
    clearError,
  };
};
