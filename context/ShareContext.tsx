import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { useSharedContent, SharedContent } from '@/hooks/useSharedContent';

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

  // When shared content is detected, navigate to compose screen
  useEffect(() => {
    if (shareHook.hasSharedContent && shareHook.sharedContent) {
      console.log('📱 ShareProvider detected shared content, navigating to compose screen');
      // Navigate to compose screen to handle shared content
      router.push('/ComposeScreen' as any);
    }
  }, [shareHook.hasSharedContent, router]);

  return (
    <ShareContext.Provider value={shareHook}>
      {children}
    </ShareContext.Provider>
  );
}

export function useShare() {
  const context = useContext(ShareContext);
  if (!context) {
    throw new Error('useShare must be used within a ShareProvider');
  }
  return context;
}
