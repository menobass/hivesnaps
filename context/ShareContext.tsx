import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { useSharedContent, SharedContent } from '@/hooks/useSharedContent';
import { getHivePostNavigationInfo } from '@/utils/extractHivePostInfo';

interface ShareContextType {
  sharedContent: SharedContent | null;
  hasSharedContent: boolean;
  isProcessingShare: boolean;
  clearSharedContent: () => void;
  simulateSharedContent?: (content: SharedContent) => void;
}

const ShareContext = createContext<ShareContextType | null>(null);

interface ShareProviderProps {
  children: ReactNode;
}

export function ShareProvider({ children }: ShareProviderProps) {
  const router = useRouter();
  const shareHook = useSharedContent();

  // When shared content is detected, check if it's a snap URL and route appropriately
  useEffect(() => {
    if (shareHook.hasSharedContent && shareHook.sharedContent) {
      console.log(
        '📱 ShareProvider detected shared content, checking content type...'
      );

      const handleSharedContent = async () => {
        try {
          // Check if it's a URL that might be a Hive post
          if (
            shareHook.sharedContent?.type === 'url' &&
            typeof shareHook.sharedContent.data === 'string'
          ) {
            const url = shareHook.sharedContent.data;
            console.log(
              '📱 ShareProvider checking if URL is a Hive post:',
              url
            );

            // Check if it's a Hive post URL and get navigation info
            const navigationInfo = await getHivePostNavigationInfo(url);

            if (navigationInfo) {
              console.log(
                '📱 ShareProvider detected Hive post URL, navigating to:',
                navigationInfo.route
              );

              // Navigate to the appropriate screen based on post type
              router.push({
                pathname: navigationInfo.route as any,
                params: {
                  author: navigationInfo.author,
                  permlink: navigationInfo.permlink,
                },
              });

              // Clear shared content after navigation
              shareHook.clearSharedContent();
              return;
            } else {
              console.log(
                '📱 ShareProvider URL is not a Hive post, treating as regular URL'
              );
            }
          }

          // Default behavior: navigate to compose screen for other content types
          console.log(
            '📱 ShareProvider navigating to compose screen for non-Hive post content'
          );
          router.push('/screens/ComposeScreen' as any);
        } catch (error) {
          console.error(
            '📱 ShareProvider error handling shared content:',
            error
          );
          // Fallback to compose screen on error
          router.push('/screens/ComposeScreen' as any);
        }
      };

      handleSharedContent();
    }
  }, [shareHook.hasSharedContent, shareHook.sharedContent, router]);

  return (
    <ShareContext.Provider value={shareHook}>{children}</ShareContext.Provider>
  );
}

export function useShare() {
  const context = useContext(ShareContext);
  if (!context) {
    throw new Error('useShare must be used within a ShareProvider');
  }
  return context;
}
