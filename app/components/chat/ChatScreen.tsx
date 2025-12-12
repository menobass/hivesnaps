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
          {message.metadata?.reactions && Object.keys(message.metadata.reactions).length > 0 && (
            <View style={styles.reactionsContainer}>
              {Object.entries(message.metadata.reactions).map(([emojiName, userIds]) => (
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
          )}
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
}> = ({ channel, onPress, isDark, styles }) => {
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
  const insets = useSafeAreaInsets();

  // Memoize styles and colors
  const styles = useMemo(() => createChatScreenStyles(), []);
  const colors = useMemo(() => getChatColors(isDark), [isDark]);

  const [messageInput, setMessageInput] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
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
      console.log('[ChatScreen] Rendering DM channel:', item.id, item.display_name, item.type);
      return (
        <DMChannelItem
          channel={item}
          onPress={() => {
            console.log('[ChatScreen] DM channel tapped:', item.id, item.type);
            selectChannel(item);
          }}
          isDark={isDark}
          styles={styles}
        />
      );
    },
    [isDark, selectChannel, styles]
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
            {/* Messages - inverted list so newest at bottom */}
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

export default ChatScreen;
