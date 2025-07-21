import { useEffect, useState } from 'react';

// Type definitions for shared content (manual sharing for now)
interface ShareItem {
  data: string;
  mimeType?: string;
}

interface ShareData {
  data?: string | ShareItem[];
  mimeType?: string;
}

export interface SharedContent {
  type: 'text' | 'url' | 'image' | 'images';
  data: string | string[];
  mimeType?: string;
}

/**
 * Hook to handle content shared from other apps
 * Currently simplified for Expo Go compatibility
 * Will be enhanced with react-native-share-menu in production builds
 */
export const useSharedContent = () => {
  const [sharedContent, setSharedContent] = useState<SharedContent | null>(null);
  const [isProcessingShare, setIsProcessingShare] = useState(false);

  // For now, this is a placeholder implementation
  // In a production build with custom dev client, we would implement:
  // - ShareMenu.getInitialShare()
  // - ShareMenu.addNewShareListener()
  
  useEffect(() => {
    // Placeholder for future native share implementation
    console.log('📱 Share hook initialized (placeholder mode)');
  }, []);

  const processShareData = (shareData: ShareData): SharedContent => {
    console.log('📱 Processing shared data:', shareData);

    // Handle multiple images
    if (shareData.data && Array.isArray(shareData.data) && shareData.data.length > 0) {
      const imageData = shareData.data.filter((item: ShareItem) => 
        item.data && (
          item.mimeType?.startsWith('image/') || 
          typeof item.data === 'string' && item.data.match(/\.(jpg|jpeg|png|gif|webp)$/i)
        )
      );
      
      if (imageData.length > 0) {
        return {
          type: imageData.length === 1 ? 'image' : 'images',
          data: imageData.length === 1 ? imageData[0].data : imageData.map((item: ShareItem) => item.data),
          mimeType: imageData[0].mimeType,
        };
      }
    }

    // Handle single item (text, URL, or single image)
    if (shareData.data) {
      const data = typeof shareData.data === 'string' ? shareData.data : shareData.data[0]?.data;
      const mimeType = shareData.mimeType || (Array.isArray(shareData.data) ? shareData.data[0]?.mimeType : undefined);

      if (!data) {
        return { type: 'text', data: '' };
      }

      // Check if it's an image
      if (mimeType?.startsWith('image/') || data.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        return {
          type: 'image',
          data,
          mimeType,
        };
      }

      // Check if it's a URL
      if (data.match(/^https?:\/\//)) {
        return {
          type: 'url',
          data,
          mimeType,
        };
      }

      // Default to text
      return {
        type: 'text',
        data,
        mimeType,
      };
    }

    // Fallback for empty or invalid data
    return { type: 'text', data: '' };
  };

  const clearSharedContent = () => {
    setSharedContent(null);
  };

  // Manual share function for testing
  const simulateSharedContent = (content: SharedContent) => {
    console.log('📱 Simulating shared content:', content);
    setSharedContent(content);
  };

  const hasSharedContent = sharedContent !== null && 
    (sharedContent.type === 'text' ? 
      typeof sharedContent.data === 'string' && sharedContent.data.trim() !== '' : 
      true);

  return {
    sharedContent,
    isProcessingShare,
    hasSharedContent,
    clearSharedContent,
    simulateSharedContent, // For testing purposes
  };
};
