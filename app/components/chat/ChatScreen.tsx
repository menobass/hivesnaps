/**
 * ChatScreen - Full-screen Ecency chat interface
 * Features:
 * - Tabbed interface (Snapie community + DMs)
 * - Message list with reactions
 * - Message input
 * - DM channel list
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
  ActivityIndicator,
  RefreshControl,
  Keyboard,
  Alert,
} from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';

import {
  useEcencyChat,
  CHAT_TABS,
  type ChatTab,
  type StartDmResult,
} from '../../../hooks/useEcencyChat';
import {
  EcencyChatMessage,
  EcencyChatChannel,
  ecencyChatService,
} from '../../../services/ecencyChatService';
import { AvatarService } from '../../../services/AvatarService';
import { createChatScreenStyles, getChatColors } from '../../../styles/ChatStyles';

// ============================================================================
// Types
// ============================================================================

interface ChatScreenProps {
  /** Username of logged-in user */
  username: string;
  /** Callback to close chat */
  onClose: () => void;
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Tab bar for switching between community and DMs
 */
const ChatTabBar: React.FC<{
  activeTab: ChatTab['id'];
  onTabChange: (tab: ChatTab['id']) => void;
  communityUnread: number;
  dmsUnread: number;
  isDark: boolean;
  styles: ReturnType<typeof createChatScreenStyles>;
}> = ({ activeTab, onTabChange, communityUnread, dmsUnread, isDark, styles }) => {
  const colors = getChatColors(isDark);

  return (
    <View style={[styles.tabBar, { backgroundColor: colors.headerBg }]}>
      {CHAT_TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const unread = tab.id === 'community' ? communityUnread : dmsUnread;
        
        return (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tab,
              isActive && { borderBottomColor: colors.accent, borderBottomWidth: 2 },
            ]}
            onPress={() => onTabChange(tab.id)}
          >
            <Text
              style={[
                styles.tabText,
                { color: isActive ? colors.accent : colors.textSecondary },
              ]}
            >
              {tab.label}
            </Text>
            {unread > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: colors.badge }]}>
                <Text style={styles.tabBadgeText}>
                  {unread > 99 ? '99+' : unread}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

/**
 * Single message bubble
 */
const MessageBubble: React.FC<{
  message: EcencyChatMessage;
  isOwnMessage: boolean;
  isDark: boolean;
  isSelected: boolean;
  onReaction: (emoji: string) => void;
  onUsernamePress?: (username: string) => void;
  onSelect: () => void;
  styles: ReturnType<typeof createChatScreenStyles>;
}> = ({ message, isOwnMessage, isDark, isSelected, onReaction, onUsernamePress, onSelect, styles }) => {
  const colors = getChatColors(isDark);
  // Clean username - remove leading @ if present
  const cleanUsername = (message.username || '').replace(/^@+/, '');
  const avatarUrl = AvatarService.imagesAvatarUrl(cleanUsername);
  const formattedTime = ecencyChatService.formatMessageTime(message.create_at);

  // Common reaction emojis
  const reactionEmojis = ['👍', '❤️', '😂', '🔥', '👀'];

  const handleReaction = (emoji: string) => {
    onReaction(emoji);
    onSelect(); // Close menu after selecting
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onSelect}
      style={[
        styles.messageBubbleContainer,
        isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer,
      ]}
    >
      {!isOwnMessage && (
        <ExpoImage
          source={{ uri: avatarUrl }}
          style={styles.messageAvatar}
          contentFit="cover"
        />
      )}
      
      <View style={styles.messageContent}>
        {!isOwnMessage && (
          <TouchableOpacity onPress={() => onUsernamePress?.(cleanUsername)}>
            <Text style={[styles.messageUsername, { color: colors.accent }]}>
              @{cleanUsername}
            </Text>
          </TouchableOpacity>
        )}
        
        <View
          style={[
            styles.messageBubble,
            {
              backgroundColor: isOwnMessage ? colors.accent : colors.messageBg,
            },
          ]}
        >
          <Text
            style={[
              styles.messageText,
              { color: isOwnMessage ? '#FFFFFF' : colors.text },
            ]}
          >
            {message.message}
          </Text>
        </View>
        
        <View style={styles.messageFooter}>
          <Text style={[styles.messageTime, { color: colors.textSecondary }]}>
            {formattedTime}
          </Text>
          
          {/* Existing reactions - always show if present */}
          {message.metadata?.reactions && Object.keys(message.metadata.reactions).length > 0 && (() => {
            // Transform reactions from indexed object to grouped by emoji
            // API returns: { "0": {emoji_name, user_id}, "1": {emoji_name, user_id}, ... }
            // We need: { "fire": ["user1", "user2"], "laughing": ["user3"], ... }
            const reactionsByEmoji: Record<string, string[]> = {};
            
            Object.values(message.metadata.reactions).forEach((reaction: any) => {
              if (reaction && reaction.emoji_name) {
                const emojiName = reaction.emoji_name;
                if (!reactionsByEmoji[emojiName]) {
                  reactionsByEmoji[emojiName] = [];
                }
                if (reaction.user_id && !reactionsByEmoji[emojiName].includes(reaction.user_id)) {
                  reactionsByEmoji[emojiName].push(reaction.user_id);
                }
              }
            });
            
            const emojiEntries = Object.entries(reactionsByEmoji);
            if (emojiEntries.length === 0) return null;
            
            return (
              <View style={styles.reactionsContainer}>
                {emojiEntries.map(([emojiName, userIds]) => (
                  <TouchableOpacity
                    key={emojiName}
                    style={[styles.reactionChip, { backgroundColor: colors.reactionBg }]}
                    onPress={() => handleReaction(ecencyChatService.emojiNameToChar(emojiName))}
                  >
                    <Text style={styles.reactionEmoji}>
                      {ecencyChatService.emojiNameToChar(emojiName)}
                    </Text>
                    <Text style={[styles.reactionCount, { color: colors.textSecondary }]}>
                      {userIds.length}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            );
          })()}
        </View>

        {/* Quick reaction buttons - only show when message is selected */}
        {isSelected && (
          <View style={[styles.quickReactions, { backgroundColor: colors.cardBg }]}>
            {reactionEmojis.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={styles.quickReactionBtn}
                onPress={() => handleReaction(emoji)}
              >
                <Text style={styles.quickReactionEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

/**
 * DM channel list item
 */
const DMChannelItem: React.FC<{
  channel: EcencyChatChannel;
  onPress: () => void;
  isDark: boolean;
  styles: ReturnType<typeof createChatScreenStyles>;
  unreadCount?: number;
}> = ({ channel, onPress, isDark, styles, unreadCount = 0 }) => {
  const colors = getChatColors(isDark);
  // Clean username - remove leading @ if present
  const rawUsername = channel.dm_partner?.username || channel.display_name;
  const partnerUsername = rawUsername.replace(/^@+/, '');
  const avatarUrl = AvatarService.imagesAvatarUrl(partnerUsername);

  return (
    <TouchableOpacity
      style={[styles.dmChannelItem, { backgroundColor: colors.cardBg }]}
      onPress={onPress}
    >
      <ExpoImage
        source={{ uri: avatarUrl }}
        style={styles.dmAvatar}
        contentFit="cover"
      />
      <View style={styles.dmInfo}>
        <Text style={[styles.dmUsername, { color: colors.text }]}>
          @{partnerUsername}
        </Text>
      </View>
      {unreadCount > 0 && (
        <View style={[styles.dmBadge, { backgroundColor: colors.badge }]}>
          <Text style={styles.dmBadgeText}>{unreadCount}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const ChatScreen: React.FC<ChatScreenProps> = ({ username, onClose }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  // Memoize styles and colors
  const styles = useMemo(() => createChatScreenStyles(), []);
  const colors = useMemo(() => getChatColors(isDark), [isDark]);

  const [messageInput, setMessageInput] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [dmSearchQuery, setDmSearchQuery] = useState('');
  const [isStartingDm, setIsStartingDm] = useState(false);
  const [dmError, setDmError] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const hasScrolledToEnd = useRef(false);
  const previousChannelId = useRef<string | null>(null);

  const {
    isInitialized,
    isInitializing,
    initError,
    communityChannel,
    dmChannels,
    selectedChannel,
    messages,
    messagesLoading,
    communityUnread,
    dmsUnread,
    channelUnreads,
    activeTab,
    setActiveTab,
    selectChannel,
    sendMessage,
    toggleReaction,
    refreshMessages,
    refreshChannels,
    markAsRead,
    initialize,
    startDm,
  } = useEcencyChat(username, true); // true = chat is open, use faster polling

  // Initialize on mount
  useEffect(() => {
    if (!isInitialized && !isInitializing) {
      initialize();
    }
  }, [isInitialized, isInitializing, initialize]);

  // Auto-select community channel when switching to community tab
  useEffect(() => {
    if (activeTab === 'community' && communityChannel && selectedChannel?.id !== communityChannel.id) {
      selectChannel(communityChannel);
    }
  }, [activeTab, communityChannel, selectedChannel, selectChannel]);

  // Mark as read when viewing messages
  useEffect(() => {
    if (selectedChannel?.id && messages.length > 0) {
      markAsRead();
    }
  }, [selectedChannel?.id, messages.length, markAsRead]);

  // Reset scroll flag when channel changes
  useEffect(() => {
    if (selectedChannel?.id !== previousChannelId.current) {
      hasScrolledToEnd.current = false;
      previousChannelId.current = selectedChannel?.id || null;
    }
  }, [selectedChannel?.id]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshChannels();
    await refreshMessages();
    setRefreshing(false);
  }, [refreshChannels, refreshMessages]);

  // Handle send message
  const handleSend = useCallback(async () => {
    if (!messageInput.trim()) return;
    
    const text = messageInput.trim();
    setMessageInput('');
    Keyboard.dismiss();
    
    const success = await sendMessage(text);
    if (success) {
      // Scroll to bottom (offset 0 for inverted list)
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 100);
    }
  }, [messageInput, sendMessage]);

  // Handle reaction
  const handleReaction = useCallback(
    async (postId: string, emoji: string) => {
      await toggleReaction(postId, emoji);
    },
    [toggleReaction]
  );

  // Handle starting a DM from a username tap
  const handleUsernamePress = useCallback(async (targetUsername: string) => {
    // Don't start DM with yourself
    if (targetUsername.toLowerCase() === username.toLowerCase()) {
      return;
    }
    setSelectedMessageId(null); // Close reaction menu
    await startDm(targetUsername);
  }, [username, startDm]);

  // Handle message selection (toggle reaction menu)
  const handleMessageSelect = useCallback((messageId: string) => {
    setSelectedMessageId(prev => prev === messageId ? null : messageId);
  }, []);

  // Filter DM channels based on search query
  const filteredDmChannels = useMemo(() => {
    if (!dmSearchQuery.trim()) {
      return dmChannels;
    }
    const query = dmSearchQuery.toLowerCase().replace(/^@/, '');
    return dmChannels.filter(channel => {
      const partnerName = (channel.dm_partner?.username || channel.display_name || '')
        .toLowerCase()
        .replace(/^@/, '');
      return partnerName.includes(query);
    });
  }, [dmChannels, dmSearchQuery]);

  // Check if search query matches an existing DM
  const searchMatchesExistingDm = useMemo(() => {
    if (!dmSearchQuery.trim()) return true;
    const query = dmSearchQuery.toLowerCase().replace(/^@/, '');
    return dmChannels.some(channel => {
      const partnerName = (channel.dm_partner?.username || channel.display_name || '')
        .toLowerCase()
        .replace(/^@/, '');
      return partnerName === query;
    });
  }, [dmChannels, dmSearchQuery]);

  // Handle starting a new DM from search
  const handleStartNewDm = useCallback(async () => {
    const targetUsername = dmSearchQuery.trim().replace(/^@/, '');
    if (!targetUsername || isStartingDm) return;
    
    setIsStartingDm(true);
    setDmError(null); // Clear previous error
    
    try {
      const result = await startDm(targetUsername);
      if (result.success) {
        setDmSearchQuery(''); // Clear search on success
      } else if (result.error) {
        // Show error to user
        if (result.errorType === 'not_on_chat') {
          // Show an alert for "not on chat" errors
          Alert.alert(
            'User Not Available',
            result.error,
            [{ text: 'OK', style: 'default' }]
          );
        } else {
          // Show inline error for other errors
          setDmError(result.error);
        }
      }
    } finally {
      setIsStartingDm(false);
    }
  }, [dmSearchQuery, isStartingDm, startDm]);

  // Render message
  const renderMessage = useCallback(
    ({ item }: { item: EcencyChatMessage }) => {
      const cleanItemUsername = (item.username || '').replace(/^@+/, '');
      const isOwnMessage = cleanItemUsername.toLowerCase() === username.toLowerCase();
      return (
        <MessageBubble
          message={item}
          isOwnMessage={isOwnMessage}
          isDark={isDark}
          isSelected={selectedMessageId === item.id}
          onReaction={(emoji) => handleReaction(item.id, emoji)}
          onUsernamePress={handleUsernamePress}
          onSelect={() => handleMessageSelect(item.id)}
          styles={styles}
        />
      );
    },
    [username, isDark, selectedMessageId, handleReaction, handleUsernamePress, handleMessageSelect, styles]
  );

  // Render DM channel
  const renderDMChannel = useCallback(
    ({ item }: { item: EcencyChatChannel }) => {
      const unreadCount = channelUnreads[item.id] || 0;
      return (
        <DMChannelItem
          channel={item}
          onPress={() => {
            selectChannel(item);
          }}
          isDark={isDark}
          styles={styles}
          unreadCount={unreadCount}
        />
      );
    },
    [isDark, selectChannel, styles, channelUnreads]
  );

  // Loading state
  if (isInitializing) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Connecting to chat...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (initError) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Chat</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={colors.badge} />
          <Text style={[styles.errorText, { color: colors.text }]}>
            Failed to connect
          </Text>
          <Text style={[styles.errorDetail, { color: colors.textSecondary }]}>
            {initError}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.accent }]}
            onPress={initialize}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {activeTab === 'dms' && selectedChannel?.type === 'D'
            ? `@${(selectedChannel.dm_partner?.username || selectedChannel.display_name || '').replace(/^@+/, '')}`
            : 'Chat'}
        </Text>
        {activeTab === 'dms' && selectedChannel?.type === 'D' ? (
          <TouchableOpacity
            onPress={() => selectChannel(null)}
            style={styles.backButton}
          >
            <Text style={[styles.backText, { color: colors.accent }]}>Back</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {/* Tab Bar */}
      <ChatTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        communityUnread={communityUnread}
        dmsUnread={dmsUnread}
        isDark={isDark}
        styles={styles}
      />

      {/* Content */}
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {activeTab === 'community' || (activeTab === 'dms' && selectedChannel?.type === 'D') ? (
          <>
            {/* Show loading overlay when switching channels */}
            {messagesLoading && messages.length === 0 ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator
                  size="large"
                  color={colors.accent}
                />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                  Loading messages...
                </Text>
              </View>
            ) : (
              /* Messages - inverted list so newest at bottom */
              <FlatList
                ref={flatListRef}
                data={[...messages].reverse()}
                renderItem={renderMessage}
                keyExtractor={(item) => item.id}
                style={styles.messageList}
                contentContainerStyle={styles.messageListContent}
                inverted={true}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    tintColor={colors.accent}
                  />
                }
                ListEmptyComponent={
                  <View style={styles.emptyMessages}>
                    <Ionicons
                      name="chatbubbles-outline"
                      size={48}
                      color={colors.textSecondary}
                    />
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                      No messages yet
                    </Text>
                  </View>
                }
              />
            )}

            {/* Input */}
            <View style={[styles.inputContainer, { backgroundColor: colors.headerBg }]}>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.inputBg,
                    color: colors.text,
                  },
                ]}
                placeholder="Type a message..."
                placeholderTextColor={colors.textSecondary}
                value={messageInput}
                onChangeText={setMessageInput}
                multiline
                maxLength={2000}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  {
                    backgroundColor: messageInput.trim()
                      ? colors.accent
                      : colors.inputBg,
                  },
                ]}
                onPress={handleSend}
                disabled={!messageInput.trim()}
              >
                <Ionicons
                  name="send"
                  size={20}
                  color={messageInput.trim() ? '#FFFFFF' : colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          /* DM Channel List with Search */
          <View style={styles.dmListContainer}>
            {/* Search Bar */}
            <View style={[styles.dmSearchContainer, { backgroundColor: colors.headerBg }]}>
              <Ionicons name="search" size={18} color={colors.textSecondary} />
              <TextInput
                style={[styles.dmSearchInput, { color: colors.text }]}
                placeholder="Search or start new conversation..."
                placeholderTextColor={colors.textSecondary}
                value={dmSearchQuery}
                onChangeText={(text) => {
                  setDmSearchQuery(text);
                  setDmError(null); // Clear error when typing
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {dmSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => { setDmSearchQuery(''); setDmError(null); }}>
                  <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Inline error message */}
            {dmError && (
              <View style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: isDark ? '#3D2020' : '#FFEBEE' }}>
                <Text style={{ color: isDark ? '#FF8A80' : '#D32F2F', fontSize: 13 }}>
                  {dmError}
                </Text>
              </View>
            )}

            {/* Start New DM option - show when searching for someone not in DMs */}
            {dmSearchQuery.trim().length > 0 && !searchMatchesExistingDm && (
              <TouchableOpacity
                style={[styles.startNewDmItem, { backgroundColor: colors.cardBg }]}
                onPress={handleStartNewDm}
                disabled={isStartingDm}
              >
                <View style={[styles.startNewDmIcon, { backgroundColor: colors.accent }]}>
                  {isStartingDm ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Ionicons name="add" size={24} color="#FFFFFF" />
                  )}
                </View>
                <View style={styles.startNewDmInfo}>
                  <Text style={[styles.startNewDmText, { color: colors.text }]}>
                    Start conversation with
                  </Text>
                  <Text style={[styles.startNewDmUsername, { color: colors.accent }]}>
                    @{dmSearchQuery.trim().replace(/^@/, '')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}

            {/* DM List */}
            <FlatList
              data={filteredDmChannels}
              renderItem={renderDMChannel}
              keyExtractor={(item) => item.id}
              style={styles.dmList}
              contentContainerStyle={styles.dmListContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor={colors.accent}
                />
              }
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                dmSearchQuery.trim() ? (
                  <View style={styles.emptyMessages}>
                    <Ionicons
                      name="search-outline"
                      size={48}
                      color={colors.textSecondary}
                    />
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                      No matching conversations
                    </Text>
                    <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                      Tap above to start a new chat
                    </Text>
                  </View>
                ) : (
                  <View style={styles.emptyMessages}>
                    <Ionicons
                      name="people-outline"
                      size={48}
                      color={colors.textSecondary}
                    />
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                      No direct messages yet
                    </Text>
                    <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                      Search for a username to start chatting
                    </Text>
                  </View>
                )
              }
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ChatScreen;
