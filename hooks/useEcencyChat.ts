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
  channelUnreads: Record<string, number>;  // Per-channel unread counts by channelId
  
  // UI state
  activeTab: ChatTab['id'];
  isChatOpen: boolean;
  
  // Actions
  initialize: () => Promise<boolean>;
  selectChannel: (channel: EcencyChatChannel | null) => void;
  setActiveTab: (tab: ChatTab['id']) => void;
  
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
  { id: 'community', label: 'Snapie Community' },
  { id: 'dms', label: 'Private Messages' },
];

// ============================================================================
// Hook Implementation
// ============================================================================

export const useEcencyChat = (
  username: string | null,
  isChatOpen: boolean = false
): UseEcencyChatResult => {
  // Session state
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  
  // Channels state
  const [channels, setChannels] = useState<EcencyChatChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<EcencyChatChannel | null>(null);
  const [snapieChannelId, setSnapieChannelId] = useState<string | null>(null);
  
  // Messages state
  const [messages, setMessages] = useState<EcencyChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [usersMap, setUsersMap] = useState<Record<string, EcencyChatUser>>({});
  
  // Unread counts
  const [totalUnread, setTotalUnread] = useState(0);
  const [communityUnread, setCommunityUnread] = useState(0);
  const [dmsUnread, setDmsUnread] = useState(0);
  const [channelUnreads, setChannelUnreads] = useState<Record<string, number>>({});
  
  // UI state
  const [activeTab, setActiveTab] = useState<ChatTab['id']>('community');
  
  // Refs for polling
  const pollingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const appState = useRef(AppState.currentState);
  const lastPollTime = useRef<number>(0);

  // --------------------------------------------------------------------------
  // Derived State
  // --------------------------------------------------------------------------

  // Use the specific Snapie channel ID, not just any community channel
  const communityChannel = snapieChannelId 
    ? channels.find(c => c.id === snapieChannelId) || null
    : null;
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
        
        // Get the Snapie community channel ID from bootstrap response
        const snapieId = result.channelId;
        if (snapieId) {
          setSnapieChannelId(snapieId);
        }
        
        // Load channels immediately after init
        const channelsList = await ecencyChatService.getChannels();
        setChannels(channelsList);
        
        // Calculate unread counts - API returns { channels, totalMentions, totalDMs, totalUnread }
        const unreads = await ecencyChatService.getUnreadCounts();
        setTotalUnread(unreads.totalUnread);
        setCommunityUnread(unreads.totalUnread - unreads.totalDMs);
        setDmsUnread(unreads.totalDMs);
        
        // Build per-channel unread map
        const perChannelUnreads: Record<string, number> = {};
        if (unreads.channels && Array.isArray(unreads.channels)) {
          for (const ch of unreads.channels) {
            perChannelUnreads[ch.channelId] = ch.message_count || 0;
          }
        }
        setChannelUnreads(perChannelUnreads);
        
        // Auto-select Snapie community channel specifically (using ID from bootstrap)
        const snapieChannel = channelsList.find(c => c.id === snapieId);
        if (snapieChannel) {
          setSelectedChannel(snapieChannel);
          if (__DEV__) {
            console.log('[useEcencyChat] Selected Snapie channel:', snapieId);
          }
        } else {
          // Snapie channel not in list - this shouldn't happen
          if (__DEV__) {
            console.warn('[useEcencyChat] Snapie channel not found in channel list:', snapieId);
          }
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
  // Message Operations (defined early so selectChannel can use loadMessages)
  // --------------------------------------------------------------------------

  const loadMessages = useCallback(async (channelId: string) => {
    // Guard against undefined/null channel ID
    if (!channelId) {
      console.warn('[useEcencyChat] loadMessages called with no channelId');
      return;
    }
    
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

  // --------------------------------------------------------------------------
  // Channel Operations
  // --------------------------------------------------------------------------

  const selectChannel = useCallback((channel: EcencyChatChannel | null) => {
    // Clear messages FIRST and set loading state BEFORE changing channel
    // This prevents showing stale messages from the previous channel
    setMessages([]);
    setMessagesLoading(true);
    setSelectedChannel(channel);
    
    if (channel?.id) {
      // Load messages for the selected channel
      loadMessages(channel.id);
    } else {
      setMessagesLoading(false);
    }
  }, [loadMessages]);

  const refreshChannels = useCallback(async () => {
    if (!isInitialized) return;
    
    try {
      const channelsList = await ecencyChatService.getChannels();
      setChannels(channelsList);
      
      // Update unread counts - API returns { channels, totalMentions, totalDMs, totalUnread }
      const unreads = await ecencyChatService.getUnreadCounts();
      setTotalUnread(unreads.totalUnread);
      setCommunityUnread(unreads.totalUnread - unreads.totalDMs);
      setDmsUnread(unreads.totalDMs);
      
      // Build per-channel unread map
      const perChannelUnreads: Record<string, number> = {};
      if (unreads.channels && Array.isArray(unreads.channels)) {
        for (const ch of unreads.channels) {
          perChannelUnreads[ch.channelId] = ch.message_count || 0;
        }
      }
      setChannelUnreads(perChannelUnreads);
    } catch (error) {
      console.error('[useEcencyChat] Refresh channels error:', error);
    }
  }, [isInitialized]);

  const markAsRead = useCallback(async () => {
    // Guard against missing channel or channel ID
    if (!selectedChannel?.id) return;
    
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
      
      // Validate channel has required fields
      if (!channel?.id) {
        console.warn('[useEcencyChat] Created DM channel has no ID');
        return null;
      }
      
      await refreshChannels();
      setActiveTab('dms');
      setSelectedChannel(channel);
      
      // Load messages for the new channel
      loadMessages(channel.id);
      
      return channel;
    } catch (error) {
      console.error('[useEcencyChat] Start DM error:', error);
      return null;
    }
  }, [isInitialized, refreshChannels, loadMessages]);

  // --------------------------------------------------------------------------
  // More Message Operations
  // --------------------------------------------------------------------------

  const refreshMessages = useCallback(async () => {
    if (!selectedChannel?.id) return;
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
  // Polling
  // --------------------------------------------------------------------------

  const poll = useCallback(async () => {
    if (!isInitialized) {
      return;
    }
    
    const now = Date.now();
    lastPollTime.current = now;
    
    try {
      // Refresh unread counts (lightweight)
      const unreads = await ecencyChatService.getUnreadCounts();
      
      // API returns: { channels: [...], totalMentions, totalDMs, totalUnread }
      // Each channel has: { channelId, type, mention_count, message_count }
      
      // Use the pre-calculated totals from the API
      const dmUnread = unreads.totalDMs || 0;
      const totalUnread = unreads.totalUnread || 0;
      
      // Calculate community unreads (total - DMs)
      const commUnread = totalUnread - dmUnread;
      
      // Build per-channel unread map
      const perChannelUnreads: Record<string, number> = {};
      if (unreads.channels && Array.isArray(unreads.channels)) {
        for (const ch of unreads.channels) {
          perChannelUnreads[ch.channelId] = ch.message_count || 0;
        }
      }
      
      setTotalUnread(totalUnread);
      setCommunityUnread(commUnread);
      setDmsUnread(dmUnread);
      setChannelUnreads(perChannelUnreads);
      
      // If chat is open and we have a selected channel, refresh messages
      if (isChatOpen && selectedChannel) {
        await refreshMessages();
      }
    } catch (error) {
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
    channelUnreads,
    
    // UI state
    activeTab,
    isChatOpen,
    
    // Actions
    initialize,
    selectChannel,
    setActiveTab,
    
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
