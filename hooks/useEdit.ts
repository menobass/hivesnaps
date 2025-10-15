import { useState, useCallback } from 'react';
import { Client, PrivateKey } from '@hiveio/dhive';
import * as SecureStore from 'expo-secure-store';
import { uploadImageSmart } from '../utils/imageUploadService';
import { stripImageTags, getAllImageUrls } from '../utils/extractImageInfo';
import * as ImagePicker from 'expo-image-picker';

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
  editImages: string[]; // Changed from single image to array
  editGifs: string[]; // Changed from single gif to array
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
  setEditImages: (images: string[]) => void;
  setEditGifs: (gifs: string[]) => void;
  addEditImage: (imageUrl: string) => void;
  removeEditImage: (imageUrl: string) => void;
  addEditGif: (gifUrl: string) => void;
  removeEditGif: (gifUrl: string) => void;
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
    editImages: [], // Changed to array
    editGifs: [], // Changed to array
    editTarget: null,
    editing: false,
    uploading: false,
    processing: false, // Initialize new state
    error: null,
  });

  const openEditModal = useCallback(
    (target: EditTarget, currentBody: string) => {
      const textBody = stripImageTags(currentBody);
      const existingImages = getAllImageUrls(currentBody); // Get ALL images

      setState(prev => ({
        ...prev,
        editTarget: target,
        editText: textBody,
        editImages: existingImages, // Array of all images
        editGifs: [], // Reset GIFs (we'll extract these if needed later)
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
      editImages: [], // Clear array
      editGifs: [], // Clear array
      editTarget: null,
      error: null,
    }));
  }, []);

  const setEditText = useCallback((text: string) => {
    setState(prev => ({ ...prev, editText: text }));
  }, []);

  const setEditImages = useCallback((images: string[]) => {
    setState(prev => ({ ...prev, editImages: images }));
  }, []);

  const setEditGifs = useCallback((gifs: string[]) => {
    setState(prev => ({ ...prev, editGifs: gifs }));
  }, []);

  const addEditImage = useCallback((imageUrl: string) => {
    setState(prev => ({ ...prev, editImages: [...prev.editImages, imageUrl] }));
  }, []);

  const removeEditImage = useCallback((imageUrl: string) => {
    setState(prev => ({ 
      ...prev, 
      editImages: prev.editImages.filter(img => img !== imageUrl) 
    }));
  }, []);

  const addEditGif = useCallback((gifUrl: string) => {
    setState(prev => ({ ...prev, editGifs: [...prev.editGifs, gifUrl] }));
  }, []);

  const removeEditGif = useCallback((gifUrl: string) => {
    setState(prev => ({ 
      ...prev, 
      editGifs: prev.editGifs.filter(gif => gif !== gifUrl) 
    }));
  }, []);

  const addImage = useCallback(async (mode: 'edit') => {
    if (mode !== 'edit') return;

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
          name: `edit-${Date.now()}.jpg`,
          type: 'image/jpeg',
        };

        const uploadResult = await uploadImageSmart(fileToUpload, currentUsername);
        console.log(`[useEdit] Image uploaded via ${uploadResult.provider} (cost: $${uploadResult.cost})`);
        
        // Add to array instead of replacing
        setState(prev => ({ 
          ...prev, 
          editImages: [...prev.editImages, uploadResult.url] 
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
    setState(prev => ({ ...prev, editGifs: [...prev.editGifs, gifUrl] }));
  }, []);

  const submitEdit = useCallback(async () => {
    if (
      !state.editTarget ||
      (!state.editText.trim() && state.editImages.length === 0 && state.editGifs.length === 0) ||
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
      
      // Add all images
      state.editImages.forEach(imageUrl => {
        body += `\n![image](${imageUrl})`;
      });
      
      // Add all GIFs
      state.editGifs.forEach(gifUrl => {
        body += `\n![gif](${gifUrl})`;
      });

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

      // Add all images and GIFs to metadata
      const allMedia = [...state.editImages, ...state.editGifs];
      if (allMedia.length > 0) {
        json_metadata.image = allMedia;
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
    state.editImages,
    state.editGifs,
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
    setEditImages,
    setEditGifs,
    addEditImage,
    removeEditImage,
    addEditGif,
    removeEditGif,
    submitEdit,
    addImage,
    addGif,
    clearError,
  };
};
