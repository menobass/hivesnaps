import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  useColorScheme,
  RefreshControl,
  Image,
  ActivityIndicator,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import Modal from 'react-native-modal';

import {
  fetchNotifications,
  parseNotification,
  formatNotificationTime,
  isActionableNotification,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  sortNotifications,
  getDefaultNotificationSettings,
  filterNotificationsBySettings,
  type ParsedNotification,
} from './utils/notifications';

interface NotificationItemProps {
  notification: ParsedNotification;
  onPress: (notification: ParsedNotification) => void;
  onMarkAsRead: (id: number) => void;
  isDark: boolean;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onPress,
  onMarkAsRead,
  isDark,
}) => {
  const handlePress = () => {
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }
    onPress(notification);
  };

  return (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        {
          backgroundColor: notification.read
            ? isDark ? '#15202B' : '#fff'
            : isDark ? '#1C2938' : '#F0F8FF',
          borderBottomColor: isDark ? '#38444D' : '#E1E8ED',
        },
      ]}
      onPress={handlePress}
      disabled={!isActionableNotification(notification)}
    >
      <View style={styles.notificationHeader}>
        <View style={[styles.iconContainer, { backgroundColor: notification.color + '20' }]}>
          <FontAwesome name={notification.icon as any} size={20} color={notification.color} />
        </View>
        <View style={styles.notificationContent}>
          <View style={styles.notificationTop}>
            <Text
              style={[
                styles.notificationMessage,
                { 
                  color: isDark ? '#D7DBDC' : '#0F1419',
                  fontWeight: notification.read ? 'normal' : '600',
                },
              ]}
              numberOfLines={2}
            >
              {notification.msg}
            </Text>
            {!notification.read && (
              <View style={[styles.unreadDot, { backgroundColor: notification.color }]} />
            )}
          </View>
          <View style={styles.notificationBottom}>
            <Text style={[styles.timeText, { color: isDark ? '#8899A6' : '#657786' }]}>
              {formatNotificationTime(notification.date)}
            </Text>
            {notification.amount && (
              <Text style={[styles.amountText, { color: '#17BF63' }]}>
                {notification.amount}
              </Text>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const NotificationsScreen = () => {
  const colorScheme = useColorScheme() || 'light';
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  const [notifications, setNotifications] = useState<ParsedNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [settings, setSettings] = useState(getDefaultNotificationSettings());

  const colors = {
    background: isDark ? '#15202B' : '#fff',
    text: isDark ? '#D7DBDC' : '#0F1419',
    subtext: isDark ? '#8899A6' : '#657786',
    border: isDark ? '#38444D' : '#E1E8ED',
    cardBackground: isDark ? '#1C2938' : '#F8F9FA',
    buttonBackground: isDark ? '#1DA1F2' : '#1DA1F2',
  };

  // Load username on mount
  useEffect(() => {
    const loadUsername = async () => {
      try {
        const username = await SecureStore.getItemAsync('hive_username');
        setCurrentUsername(username);
      } catch (error) {
        console.error('Error loading username:', error);
      }
    };
    loadUsername();
  }, []);

  // Load notifications when username is available
  useEffect(() => {
    if (currentUsername) {
      loadNotifications();
    }
  }, [currentUsername]);

  const loadNotifications = async (isRefresh = false) => {
    if (!currentUsername) return;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const rawNotifications = await fetchNotifications(currentUsername, 50);
      const parsed = rawNotifications.map(parseNotification);
      
      // Load read status from local storage
      const readNotifications = await loadReadStatus();
      const withReadStatus = parsed.map(notification => ({
        ...notification,
        read: readNotifications.includes(notification.id),
      }));

      // Filter by settings and sort
      const filtered = filterNotificationsBySettings(withReadStatus, settings);
      const sorted = sortNotifications(filtered);

      setNotifications(sorted);
    } catch (error) {
      console.error('Error loading notifications:', error);
      Alert.alert('Error', 'Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadReadStatus = async (): Promise<number[]> => {
    try {
      const readStatus = await SecureStore.getItemAsync('notification_read_status');
      return readStatus ? JSON.parse(readStatus) : [];
    } catch (error) {
      console.error('Error loading read status:', error);
      return [];
    }
  };

  const saveReadStatus = async (readIds: number[]) => {
    try {
      await SecureStore.setItemAsync('notification_read_status', JSON.stringify(readIds));
    } catch (error) {
      console.error('Error saving read status:', error);
    }
  };

  const handleNotificationPress = (notification: ParsedNotification) => {
    if (isActionableNotification(notification) && notification.targetContent) {
      // Navigate to the post/comment
      router.push({
        pathname: '/ConversationScreen',
        params: {
          author: notification.targetContent.author,
          permlink: notification.targetContent.permlink,
        },
      });
    }
  };

  const handleMarkAsRead = useCallback(async (notificationId: number) => {
    const updated = markAsRead(notifications, notificationId);
    setNotifications(updated);
    
    const readIds = updated.filter(n => n.read).map(n => n.id);
    await saveReadStatus(readIds);
  }, [notifications]);

  const handleMarkAllAsRead = useCallback(async () => {
    const updated = markAllAsRead(notifications);
    setNotifications(updated);
    
    const readIds = updated.map(n => n.id);
    await saveReadStatus(readIds);
  }, [notifications]);

  const handleRefresh = () => {
    loadNotifications(true);
  };

  const unreadCount = getUnreadCount(notifications);

  const renderNotification = ({ item }: { item: ParsedNotification }) => (
    <NotificationItem
      notification={item}
      onPress={handleNotificationPress}
      onMarkAsRead={handleMarkAsRead}
      isDark={isDark}
    />
  );

  const renderHeader = () => (
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      <View style={styles.headerLeft}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
      </View>
      <View style={styles.headerRight}>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.markAllButton}>
            <Text style={[styles.markAllText, { color: colors.buttonBackground }]}>
              Mark all read
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => setSettingsVisible(true)} style={styles.settingsButton}>
          <FontAwesome name="cog" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <FontAwesome name="bell-o" size={64} color={colors.subtext} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No notifications</Text>
      <Text style={[styles.emptySubtitle, { color: colors.subtext }]}>
        You're all caught up! New notifications will appear here.
      </Text>
    </View>
  );

  const renderSettings = () => (
    <Modal
      isVisible={settingsVisible}
      onBackdropPress={() => setSettingsVisible(false)}
      onBackButtonPress={() => setSettingsVisible(false)}
      style={styles.modalStyle}
    >
      <View style={[styles.settingsModal, { backgroundColor: colors.background }]}>
        <View style={[styles.settingsHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.settingsTitle, { color: colors.text }]}>
            Notification Settings
          </Text>
          <TouchableOpacity onPress={() => setSettingsVisible(false)}>
            <FontAwesome name="times" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.settingsContent}>
          {[
            { key: 'votes', label: 'Votes on my posts', icon: 'arrow-up' },
            { key: 'replies', label: 'Replies to my posts', icon: 'comment' },
            { key: 'reblogs', label: 'Reblogs of my posts', icon: 'repeat' },
            { key: 'follows', label: 'New followers', icon: 'user-plus' },
            { key: 'mentions', label: 'Mentions', icon: 'at' },
            { key: 'communityUpdates', label: 'Community updates', icon: 'users' },
          ].map(({ key, label, icon }) => (
            <View key={key} style={[styles.settingItem, { borderBottomColor: colors.border }]}>
              <View style={styles.settingLeft}>
                <FontAwesome name={icon as any} size={20} color={colors.text} />
                <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
              </View>
              <Switch
                value={settings[key as keyof typeof settings] as boolean}
                onValueChange={(value) => setSettings(prev => ({ ...prev, [key]: value }))}
                trackColor={{ false: colors.border, true: colors.buttonBackground + '50' }}
                thumbColor={colors.buttonBackground}
              />
            </View>
          ))}
        </View>
        
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.buttonBackground }]}
          onPress={() => {
            setSettingsVisible(false);
            loadNotifications(); // Reload with new settings
          }}
        >
          <Text style={styles.saveButtonText}>Save Settings</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );

  if (!currentUsername) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <Text style={[styles.errorText, { color: colors.subtext }]}>
            Please log in to view notifications
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {renderHeader()}
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.buttonBackground} />
          <Text style={[styles.loadingText, { color: colors.subtext }]}>
            Loading notifications...
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.buttonBackground}
            />
          }
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : undefined}
        />
      )}
      
      {renderSettings()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  markAllButton: {
    marginRight: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  markAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  settingsButton: {
    padding: 4,
  },
  notificationItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 15,
    lineHeight: 20,
    flex: 1,
    marginRight: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  notificationBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: 13,
  },
  amountText: {
    fontSize: 13,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalStyle: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  settingsModal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  settingsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  settingsContent: {
    paddingHorizontal: 20,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    marginLeft: 12,
  },
  saveButton: {
    marginHorizontal: 20,
    marginVertical: 20,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default NotificationsScreen;
