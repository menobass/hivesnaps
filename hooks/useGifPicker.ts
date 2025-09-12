import { useState, useCallback } from 'react';
import { searchGifs as searchGifsApi, getTrendingGifs } from '../utils/tenorApi';

export type GifMode = 'reply' | 'edit';

interface GifPickerState {
  gifModalVisible: boolean;
  gifSearchQuery: string;
  gifResults: any[];
  gifLoading: boolean;
  gifMode: GifMode;
}

interface UseGifPickerReturn extends GifPickerState {
  openGifPicker: (mode: GifMode) => void;
  closeGifModal: () => void;
  setGifSearchQuery: (query: string) => void;
  searchGifs: (query: string) => Promise<void>;
  selectGif: (gifUrl: string) => void;
  clearGifResults: () => void;
}

export const useGifPicker = (): UseGifPickerReturn => {
  const [state, setState] = useState<GifPickerState>({
    gifModalVisible: false,
    gifSearchQuery: '',
    gifResults: [],
    gifLoading: false,
    gifMode: 'reply',
  });

  const openGifPicker = useCallback((mode: GifMode) => {
    setState(prev => ({
      ...prev,
      gifMode: mode,
      gifModalVisible: true,
      gifResults: [],
      gifSearchQuery: '',
    }));
  }, []);

  const closeGifModal = useCallback(() => {
    setState(prev => ({
      ...prev,
      gifModalVisible: false,
      gifSearchQuery: '',
      gifResults: [],
    }));
  }, []);

  const setGifSearchQuery = useCallback((query: string) => {
    setState(prev => ({ ...prev, gifSearchQuery: query }));
  }, []);

  const searchGifs = useCallback(async (query: string) => {
    setState(prev => ({ ...prev, gifLoading: true }));

    try {
      const response = query.trim()
        ? await searchGifsApi(query, 20)
        : await getTrendingGifs(20);

      setState(prev => ({
        ...prev,
        gifResults: response.results,
        gifLoading: false,
      }));
    } catch (error) {
      console.error('Error searching GIFs:', error);
      setState(prev => ({
        ...prev,
        gifResults: [],
        gifLoading: false,
      }));
    }
  }, []);

  const selectGif = useCallback(
    (gifUrl: string) => {
      // This will be handled by the parent component through a callback
      // The hook just manages the modal state
      closeGifModal();
    },
    [closeGifModal]
  );

  const clearGifResults = useCallback(() => {
    setState(prev => ({ ...prev, gifResults: [] }));
  }, []);

  return {
    ...state,
    openGifPicker,
    closeGifModal,
    setGifSearchQuery,
    searchGifs,
    selectGif,
    clearGifResults,
  };
};
