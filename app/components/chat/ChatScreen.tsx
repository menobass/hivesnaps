/**
 * ChatScreen - Full-screen Ecency chat interface
 * Features:
 * - Tabbed interface (Snapie community + DMs)
 * - Message list with reactions
 * - Message input
 * - DM channel list
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
  ActivityIndicator,
  RefreshControl,
  Keyboard,
} from 'react-native';
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
} from '../../../hooks/useEcencyChat';
import {
  EcencyChatMessage,
  EcencyChatChannel,
  ecencyChatService,
} from '../../../services/ecencyChatService';
import { AvatarService } from '../../../services/AvatarService';

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
}> = ({ activeTab, onTabChange, communityUnread, dmsUnread, isDark }) => {
  const colors = getColors(isDark);

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
  onReaction: (emoji: string) => void;
}> = ({ message, isOwnMessage, isDark, onReaction }) => {
  const colors = getColors(isDark);
  const avatarUrl = AvatarService.imagesAvatarUrl(message.username || '');
  const formattedTime = ecencyChatService.formatMessageTime(message.create_at);

  // Common reaction emojis
  const reactionEmojis = ['👍', '❤️', '😂', '🔥', '👀'];

  return (
    <View
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
          <Text style={[styles.messageUsername, { color: colors.accent }]}>
            @{message.username}
          </Text>
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
          
          {/* Existing reactions */}
          {message.metadata?.reactions && Object.keys(message.metadata.reactions).length > 0 && (
            <View style={styles.reactionsContainer}>
              {Object.entries(message.metadata.reactions).map(([emojiName, userIds]) => (
                <TouchableOpacity
                  key={emojiName}
                  style={[styles.reactionChip, { backgroundColor: colors.reactionBg }]}
                  onPress={() => onReaction(ecencyChatService.emojiNameToChar(emojiName))}
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
          )}
        </View>

        {/* Quick reaction buttons (shown on long press or always for simplicity) */}
        <View style={styles.quickReactions}>
          {reactionEmojis.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              style={styles.quickReactionBtn}
              onPress={() => onReaction(emoji)}
            >
              <Text style={styles.quickReactionEmoji}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
};

/**
 * DM channel list item
 */
const DMChannelItem: React.FC<{
  channel: EcencyChatChannel;
  onPress: () => void;
  isDark: boolean;
}> = ({ channel, onPress, isDark }) => {
  const colors = getColors(isDark);
  const partnerUsername = channel.dm_partner?.username || channel.display_name;
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
        {channel.unread_count && channel.unread_count > 0 && (
          <View style={[styles.dmBadge, { backgroundColor: colors.badge }]}>
            <Text style={styles.dmBadgeText}>{channel.unread_count}</Text>
          </View>
        )}
      </View>
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
  const colors = getColors(isDark);
  const insets = useSafeAreaInsets();

  const [messageInput, setMessageInput] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const flatListRef = useRef<FlatList>(null);

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
    activeTab,
    setActiveTab,
    selectChannel,
    sendMessage,
    toggleReaction,
    refreshMessages,
    refreshChannels,
    markAsRead,
    initialize,
  } = useEcencyChat(username);

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
    if (selectedChannel && messages.length > 0) {
      markAsRead();
    }
  }, [selectedChannel, messages.length, markAsRead]);

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
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
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

  // Render message
  const renderMessage = useCallback(
    ({ item }: { item: EcencyChatMessage }) => {
      const isOwnMessage = item.username?.toLowerCase() === username.toLowerCase();
      return (
        <MessageBubble
          message={item}
          isOwnMessage={isOwnMessage}
          isDark={isDark}
          onReaction={(emoji) => handleReaction(item.id, emoji)}
        />
      );
    },
    [username, isDark, handleReaction]
  );

  // Render DM channel
  const renderDMChannel = useCallback(
    ({ item }: { item: EcencyChatChannel }) => (
      <DMChannelItem
        channel={item}
        onPress={() => selectChannel(item)}
        isDark={isDark}
      />
    ),
    [isDark, selectChannel]
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
            ? `@${selectedChannel.dm_partner?.username || selectedChannel.display_name}`
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
      />

      {/* Content */}
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {activeTab === 'community' || (activeTab === 'dms' && selectedChannel?.type === 'D') ? (
          <>
            {/* Messages */}
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              style={styles.messageList}
              contentContainerStyle={styles.messageListContent}
              inverted={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor={colors.accent}
                />
              }
              ListEmptyComponent={
                messagesLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.accent}
                    style={styles.messagesLoading}
                  />
                ) : (
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
                )
              }
            />

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
          /* DM Channel List */
          <FlatList
            data={dmChannels}
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
            ListEmptyComponent={
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
                  Start a conversation from someone's profile
                </Text>
              </View>
            }
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ============================================================================
// Colors Helper
// ============================================================================

const getColors = (isDark: boolean) => ({
  background: isDark ? '#000000' : '#FFFFFF',
  headerBg: isDark ? '#1C1C1E' : '#F5F5F5',
  cardBg: isDark ? '#1C1C1E' : '#FFFFFF',
  text: isDark ? '#FFFFFF' : '#000000',
  textSecondary: isDark ? '#8E8E93' : '#6B7280',
  accent: '#1DA1F2',
  badge: '#FF3B30',
  messageBg: isDark ? '#2C2C2E' : '#E5E5EA',
  inputBg: isDark ? '#2C2C2E' : '#FFFFFF',
  reactionBg: isDark ? '#3A3A3C' : '#F0F0F0',
});

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
  },
  errorDetail: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeButton: {
    padding: 4,
    width: 44,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 44,
  },
  backButton: {
    padding: 4,
    width: 44,
  },
  backText: {
    fontSize: 16,
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128, 128, 128, 0.3)',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
  },
  tabBadge: {
    marginLeft: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },

  // Content
  content: {
    flex: 1,
  },

  // Message List
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 12,
  },
  messagesLoading: {
    marginTop: 24,
  },
  emptyMessages: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 48,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 4,
  },

  // Message Bubble
  messageBubbleContainer: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  ownMessageContainer: {
    justifyContent: 'flex-end',
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  messageContent: {
    maxWidth: '75%',
  },
  messageUsername: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  messageBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
  },
  reactionsContainer: {
    flexDirection: 'row',
    marginLeft: 8,
  },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 4,
  },
  reactionEmoji: {
    fontSize: 12,
  },
  reactionCount: {
    fontSize: 11,
    marginLeft: 2,
  },
  quickReactions: {
    flexDirection: 'row',
    marginTop: 4,
    opacity: 0.6,
  },
  quickReactionBtn: {
    padding: 4,
  },
  quickReactionEmoji: {
    fontSize: 14,
  },

  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128, 128, 128, 0.3)',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    fontSize: 15,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },

  // DM List
  dmList: {
    flex: 1,
  },
  dmListContent: {
    padding: 12,
  },
  dmChannelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  dmAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  dmInfo: {
    flex: 1,
    marginLeft: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dmUsername: {
    fontSize: 16,
    fontWeight: '500',
  },
  dmBadge: {
    marginLeft: 8,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  dmBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default ChatScreen;
