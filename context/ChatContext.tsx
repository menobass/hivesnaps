/**
 * ChatContext - Global chat state management
 * Provides chat functionality across the entire app
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import { Modal, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useEcencyChat } from '../hooks/useEcencyChat';
import { ChatScreen } from '../app/components/chat/ChatScreen';
import { useCurrentUser } from '../store/context';

// ============================================================================
// Types
// ============================================================================

interface ChatContextValue {
  /** Whether chat is currently open (full screen) */
  isChatOpen: boolean;
  /** Open the chat screen */
  openChat: () => void;
  /** Close the chat screen */
  closeChat: () => void;
  /** Total unread message count */
  unreadCount: number;
  /** Unread DM count only (excludes community chat) */
  dmsUnreadCount: number;
  /** Start a DM with a specific user */
  startDmWithUser: (username: string) => Promise<void>;
  /** Whether chat is initialized */
  isInitialized: boolean;
  /** Initialize chat session */
  initializeChat: () => Promise<boolean>;
}

// ============================================================================
// Context
// ============================================================================

const ChatContext = createContext<ChatContextValue | null>(null);

// ============================================================================
// Hook
// ============================================================================

export const useChat = (): ChatContextValue => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

// ============================================================================
// Provider
// ============================================================================

interface ChatProviderProps {
  children: ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({
  children,
}) => {
  const username = useCurrentUser();
  const colorScheme = useColorScheme();
  const [isChatOpen, setIsChatOpen] = useState(false);

  const {
    isInitialized,
    isInitializing,
    totalUnread,
    dmsUnread,
    initialize,
    startDm,
  } = useEcencyChat(username, isChatOpen);

  // Auto-initialize chat when user is logged in
  // This enables polling for unread counts even before opening chat
  useEffect(() => {
    if (username && !isInitialized && !isInitializing) {
      console.log('[ChatProvider] Auto-initializing chat for user:', username);
      initialize();
    }
  }, [username, isInitialized, isInitializing, initialize]);

  // Open chat screen
  const openChat = useCallback(() => {
    setIsChatOpen(true);
  }, []);

  // Close chat screen
  const closeChat = useCallback(() => {
    setIsChatOpen(false);
  }, []);

  // Start DM with a user and open chat
  const startDmWithUser = useCallback(async (targetUsername: string) => {
    if (!isInitialized) {
      await initialize();
    }
    await startDm(targetUsername);
    setIsChatOpen(true);
  }, [isInitialized, initialize, startDm]);

  // Initialize chat
  const initializeChat = useCallback(async (): Promise<boolean> => {
    return initialize();
  }, [initialize]);

  // Context value
  const value: ChatContextValue = {
    isChatOpen,
    openChat,
    closeChat,
    unreadCount: totalUnread,
    dmsUnreadCount: dmsUnread,
    startDmWithUser,
    isInitialized,
    initializeChat,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
      
      {/* Chat Screen - full screen modal */}
      <Modal
        visible={isChatOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeChat}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          {username && (
            <ChatScreen
              username={username}
              onClose={closeChat}
            />
          )}
        </GestureHandlerRootView>
      </Modal>
    </ChatContext.Provider>
  );
};

export default ChatProvider;
