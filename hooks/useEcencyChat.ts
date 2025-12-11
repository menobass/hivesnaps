/**
 * Ecency Chat Hook
 * Manages chat state, session lifecycle, polling, and UI interactions
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import {
  ecencyChatService,
  EcencyChatChannel,
  EcencyChatMessage,
  EcencyChatUser,
  MessagesResponse,
} from '../services/ecencyChatService';

// ============================================================================
// Types
// ============================================================================

export interface ChatTab {
  id: 'community' | 'dms';
  label: string;
}

export interface UseEcencyChatResult {
  // Session state
  isInitialized: boolean;
  isInitializing: boolean;
  initError: string | null;
  
  // Channels
  channels: EcencyChatChannel[];
  communityChannel: EcencyChatChannel | null;
  dmChannels: EcencyChatChannel[];
  selectedChannel: EcencyChatChannel | null;
  
  // Messages
  messages: EcencyChatMessage[];
  messagesLoading: boolean;
  usersMap: Record<string, EcencyChatUser>;
  
  // Unread counts
  totalUnread: number;
  communityUnread: number;
  dmsUnread: number;
  
  // UI state
  activeTab: ChatTab['id'];
  isChatOpen: boolean;
  
  // Actions
  initialize: () => Promise<boolean>;
  selectChannel: (channel: EcencyChatChannel | null) => void;
  setActiveTab: (tab: ChatTab['id']) => void;
  openChat: () => void;
  closeChat: () => void;
  
  // Message actions
  sendMessage: (message: string, rootId?: string) => Promise<boolean>;
  editMessage: (postId: string, message: string) => Promise<boolean>;
  deleteMessage: (postId: string) => Promise<boolean>;
  toggleReaction: (postId: string, emoji: string) => Promise<boolean>;
  
  // Channel actions
  refreshChannels: () => Promise<void>;
  refreshMessages: () => Promise<void>;
  markAsRead: () => Promise<void>;
  startDm: (username: string) => Promise<EcencyChatChannel | null>;
  
  // Polling control
  startPolling: () => void;
  stopPolling: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const POLLING_INTERVAL_ACTIVE = 5000; // 5 seconds when chat is open
const POLLING_INTERVAL_BACKGROUND = 30000; // 30 seconds when minimized
const POLLING_INTERVAL_INACTIVE = 60000; // 1 minute when app is backgrounded
const CHAT_OPEN_KEY = 'ecency_chat_open';

export const CHAT_TABS: ChatTab[] = [
  { id: 'community', label: 'Snapie' },
  { id: 'dms', label: 'Messages' },
];

// ============================================================================
// Hook Implementation
// ============================================================================

export const useEcencyChat = (username: string | null): UseEcencyChatResult => {
  // Session state
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  
  // Channels state
  const [channels, setChannels] = useState<EcencyChatChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<EcencyChatChannel | null>(null);
  
  // Messages state
  const [messages, setMessages] = useState<EcencyChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [usersMap, setUsersMap] = useState<Record<string, EcencyChatUser>>({});
  
  // Unread counts
  const [totalUnread, setTotalUnread] = useState(0);
  const [communityUnread, setCommunityUnread] = useState(0);
  const [dmsUnread, setDmsUnread] = useState(0);
  
  // UI state
  const [activeTab, setActiveTab] = useState<ChatTab['id']>('community');
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  // Refs for polling
  const pollingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const appState = useRef(AppState.currentState);
  const lastPollTime = useRef<number>(0);

  // --------------------------------------------------------------------------
  // Derived State
  // --------------------------------------------------------------------------

  const communityChannel = channels.find(c => c.type === 'O') || null;
  const dmChannels = channels.filter(c => c.type === 'D');

  // --------------------------------------------------------------------------
  // Session Management
  // --------------------------------------------------------------------------

  const initialize = useCallback(async (): Promise<boolean> => {
    if (!username) {
      setInitError('Not logged in');
      return false;
    }

    setIsInitializing(true);
    setInitError(null);

    try {
      const result = await ecencyChatService.bootstrap();
      
      if (result.ok) {
        setIsInitialized(true);
        
        // Load channels immediately after init
        const channelsList = await ecencyChatService.getChannels();
        setChannels(channelsList);
        
        // Calculate unread counts
        const unreads = await ecencyChatService.getUnreadCounts();
        setTotalUnread(unreads.total_unread);
        
        // Split unread by channel type
        let commUnread = 0;
        let dmUnread = 0;
        channelsList.forEach(ch => {
          const chUnread = unreads.channels[ch.id]?.unread || 0;
          if (ch.type === 'O') {
            commUnread += chUnread;
          } else {
            dmUnread += chUnread;
          }
        });
        setCommunityUnread(commUnread);
        setDmsUnread(dmUnread);
        
        // Auto-select community channel
        const community = channelsList.find(c => c.type === 'O');
        if (community) {
          setSelectedChannel(community);
        }
        
        if (__DEV__) {
          console.log('[useEcencyChat] Initialized successfully');
        }
        return true;
      } else {
        setInitError(result.error || 'Bootstrap failed');
        return false;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setInitError(errorMsg);
      console.error('[useEcencyChat] Initialize error:', error);
      return false;
    } finally {
      setIsInitializing(false);
    }
  }, [username]);

  // Clear session on logout
  useEffect(() => {
    if (!username && isInitialized) {
      ecencyChatService.clearSession();
      setIsInitialized(false);
      setChannels([]);
      setMessages([]);
      setSelectedChannel(null);
      setTotalUnread(0);
      setCommunityUnread(0);
      setDmsUnread(0);
    }
  }, [username, isInitialized]);

  // --------------------------------------------------------------------------
  // Channel Operations
  // --------------------------------------------------------------------------

  const selectChannel = useCallback((channel: EcencyChatChannel | null) => {
    setSelectedChannel(channel);
    setMessages([]);
    
    if (channel) {
      // Load messages for the selected channel
      loadMessages(channel.id);
    }
  }, []);

  const refreshChannels = useCallback(async () => {
    if (!isInitialized) return;
    
    try {
      const channelsList = await ecencyChatService.getChannels();
      setChannels(channelsList);
      
      // Update unread counts
      const unreads = await ecencyChatService.getUnreadCounts();
      setTotalUnread(unreads.total_unread);
      
      let commUnread = 0;
      let dmUnread = 0;
      channelsList.forEach(ch => {
        const chUnread = unreads.channels[ch.id]?.unread || 0;
        if (ch.type === 'O') {
          commUnread += chUnread;
        } else {
          dmUnread += chUnread;
        }
      });
      setCommunityUnread(commUnread);
      setDmsUnread(dmUnread);
    } catch (error) {
      console.error('[useEcencyChat] Refresh channels error:', error);
    }
  }, [isInitialized]);

  const markAsRead = useCallback(async () => {
    if (!selectedChannel) return;
    
    try {
      await ecencyChatService.markChannelViewed(selectedChannel.id);
      await refreshChannels();
    } catch (error) {
      console.error('[useEcencyChat] Mark as read error:', error);
    }
  }, [selectedChannel, refreshChannels]);

  const startDm = useCallback(async (targetUsername: string): Promise<EcencyChatChannel | null> => {
    if (!isInitialized) return null;
    
    try {
      const channel = await ecencyChatService.createDirectChannel(targetUsername);
      await refreshChannels();
      setActiveTab('dms');
      setSelectedChannel(channel);
      return channel;
    } catch (error) {
      console.error('[useEcencyChat] Start DM error:', error);
      return null;
    }
  }, [isInitialized, refreshChannels]);

  // --------------------------------------------------------------------------
  // Message Operations
  // --------------------------------------------------------------------------

  const loadMessages = useCallback(async (channelId: string) => {
    setMessagesLoading(true);
    
    try {
      const data = await ecencyChatService.getMessages(channelId);
      setMessages(data.posts || []);
      setUsersMap(data.users || {});
    } catch (error) {
      console.error('[useEcencyChat] Load messages error:', error);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  const refreshMessages = useCallback(async () => {
    if (!selectedChannel) return;
    await loadMessages(selectedChannel.id);
  }, [selectedChannel, loadMessages]);

  const sendMessage = useCallback(async (message: string, rootId?: string): Promise<boolean> => {
    if (!selectedChannel || !message.trim()) return false;
    
    try {
      await ecencyChatService.sendMessage(selectedChannel.id, message, rootId);
      await refreshMessages();
      return true;
    } catch (error) {
      console.error('[useEcencyChat] Send message error:', error);
      return false;
    }
  }, [selectedChannel, refreshMessages]);

  const editMessage = useCallback(async (postId: string, message: string): Promise<boolean> => {
    if (!selectedChannel) return false;
    
    try {
      await ecencyChatService.editMessage(selectedChannel.id, postId, message);
      await refreshMessages();
      return true;
    } catch (error) {
      console.error('[useEcencyChat] Edit message error:', error);
      return false;
    }
  }, [selectedChannel, refreshMessages]);

  const deleteMessage = useCallback(async (postId: string): Promise<boolean> => {
    if (!selectedChannel) return false;
    
    try {
      await ecencyChatService.deleteMessage(selectedChannel.id, postId);
      await refreshMessages();
      return true;
    } catch (error) {
      console.error('[useEcencyChat] Delete message error:', error);
      return false;
    }
  }, [selectedChannel, refreshMessages]);

  const toggleReaction = useCallback(async (postId: string, emoji: string): Promise<boolean> => {
    if (!selectedChannel) return false;
    
    try {
      // Check if user already has this reaction
      const message = messages.find(m => m.id === postId);
      const userId = ecencyChatService.getUserId();
      const emojiName = ecencyChatService.emojiCharToName(emoji);
      const hasReaction = message?.metadata?.reactions?.[emojiName]?.includes(userId || '') || false;
      
      await ecencyChatService.toggleReaction(selectedChannel.id, postId, emoji, !hasReaction);
      await refreshMessages();
      return true;
    } catch (error) {
      console.error('[useEcencyChat] Toggle reaction error:', error);
      return false;
    }
  }, [selectedChannel, messages, refreshMessages]);

  // --------------------------------------------------------------------------
  // UI State
  // --------------------------------------------------------------------------

  const openChat = useCallback(() => {
    setIsChatOpen(true);
    SecureStore.setItemAsync(CHAT_OPEN_KEY, 'true');
    
    // Auto-initialize if needed
    if (!isInitialized && !isInitializing && username) {
      initialize();
    }
  }, [isInitialized, isInitializing, username, initialize]);

  const closeChat = useCallback(() => {
    setIsChatOpen(false);
    SecureStore.setItemAsync(CHAT_OPEN_KEY, 'false');
  }, []);

  // --------------------------------------------------------------------------
  // Polling
  // --------------------------------------------------------------------------

  const poll = useCallback(async () => {
    if (!isInitialized) return;
    
    const now = Date.now();
    lastPollTime.current = now;
    
    try {
      // Refresh unread counts (lightweight)
      const unreads = await ecencyChatService.getUnreadCounts();
      setTotalUnread(unreads.total_unread);
      
      // If chat is open and we have a selected channel, refresh messages
      if (isChatOpen && selectedChannel) {
        await refreshMessages();
      }
    } catch (error) {
      // Silently fail polls to avoid spamming errors
      if (__DEV__) {
        console.log('[useEcencyChat] Poll error:', error);
      }
    }
  }, [isInitialized, isChatOpen, selectedChannel, refreshMessages]);

  const startPolling = useCallback(() => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
    }
    
    const interval = isChatOpen ? POLLING_INTERVAL_ACTIVE : POLLING_INTERVAL_BACKGROUND;
    pollingInterval.current = setInterval(poll, interval);
    
    if (__DEV__) {
      console.log(`[useEcencyChat] Started polling (${interval}ms)`);
    }
  }, [poll, isChatOpen]);

  const stopPolling = useCallback(() => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
      
      if (__DEV__) {
        console.log('[useEcencyChat] Stopped polling');
      }
    }
  }, []);

  // Adjust polling based on app state
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground
        if (isInitialized) {
          poll(); // Immediate poll
          startPolling();
        }
      } else if (nextAppState.match(/inactive|background/)) {
        // App went to background - slow down polling
        stopPolling();
        if (isInitialized) {
          pollingInterval.current = setInterval(poll, POLLING_INTERVAL_INACTIVE);
        }
      }
      
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isInitialized, poll, startPolling, stopPolling]);

  // Start/stop polling based on initialization
  useEffect(() => {
    if (isInitialized) {
      startPolling();
    } else {
      stopPolling();
    }
    
    return () => {
      stopPolling();
    };
  }, [isInitialized, startPolling, stopPolling]);

  // Restart polling when chat open state changes
  useEffect(() => {
    if (isInitialized) {
      startPolling();
    }
  }, [isChatOpen, isInitialized, startPolling]);

  // --------------------------------------------------------------------------
  // Return
  // --------------------------------------------------------------------------

  return {
    // Session state
    isInitialized,
    isInitializing,
    initError,
    
    // Channels
    channels,
    communityChannel,
    dmChannels,
    selectedChannel,
    
    // Messages
    messages,
    messagesLoading,
    usersMap,
    
    // Unread counts
    totalUnread,
    communityUnread,
    dmsUnread,
    
    // UI state
    activeTab,
    isChatOpen,
    
    // Actions
    initialize,
    selectChannel,
    setActiveTab,
    openChat,
    closeChat,
    
    // Message actions
    sendMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
    
    // Channel actions
    refreshChannels,
    refreshMessages,
    markAsRead,
    startDm,
    
    // Polling control
    startPolling,
    stopPolling,
  };
};
