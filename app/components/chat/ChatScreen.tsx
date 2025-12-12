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
  onReaction: (emoji: string) => void;
  styles: ReturnType<typeof createChatScreenStyles>;
}> = ({ message, isOwnMessage, isDark, onReaction, styles }) => {
  const colors = getChatColors(isDark);
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
  styles: ReturnType<typeof createChatScreenStyles>;
}> = ({ channel, onPress, isDark, styles }) => {
  const colors = getChatColors(isDark);
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
  const insets = useSafeAreaInsets();

  // Memoize styles and colors
  const styles = useMemo(() => createChatScreenStyles(), []);
  const colors = useMemo(() => getChatColors(isDark), [isDark]);

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
          styles={styles}
        />
      );
    },
    [username, isDark, handleReaction, styles]
  );

  // Render DM channel
  const renderDMChannel = useCallback(
    ({ item }: { item: EcencyChatChannel }) => (
      <DMChannelItem
        channel={item}
        onPress={() => selectChannel(item)}
        isDark={isDark}
        styles={styles}
      />
    ),
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

export default ChatScreen;
