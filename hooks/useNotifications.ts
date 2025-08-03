import { useState, useEffect, useCallback, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import { AppState, AppStateStatus } from 'react-native';

import {
  fetchNotifications,
  parseNotification,
  getUnreadCount,
  sortNotifications,
  getDefaultNotificationSettings,
  filterNotificationsBySettings,
  type ParsedNotification,
} from '../utils/notifications';

interface UseNotificationsResult {
  notifications: ParsedNotification[];
  unreadCount: number;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  settings: ReturnType<typeof getDefaultNotificationSettings>;
  refresh: () => Promise<void>;
  markAsRead: (notificationId: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  updateSettings: (
    newSettings: Partial<ReturnType<typeof getDefaultNotificationSettings>>
  ) => void;
}

const STORAGE_KEYS = {
  READ_STATUS: 'notification_read_status',
  SETTINGS: 'notification_settings',
  LAST_CHECK: 'notification_last_check',
};

export const useNotifications = (
  username: string | null
): UseNotificationsResult => {
  const [notifications, setNotifications] = useState<ParsedNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState(getDefaultNotificationSettings());

  const appState = useRef(AppState.currentState);
  const lastFetchTime = useRef<number>(0);
  const refreshInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load settings from storage
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedSettings = await SecureStore.getItemAsync(
          STORAGE_KEYS.SETTINGS
        );
        if (storedSettings) {
          setSettings({
            ...getDefaultNotificationSettings(),
            ...JSON.parse(storedSettings),
          });
        }
      } catch (error) {
        console.error('Error loading notification settings:', error);
      }
    };
    loadSettings();
  }, []);

  // Save settings to storage
  const updateSettings = useCallback(
    async (
      newSettings: Partial<ReturnType<typeof getDefaultNotificationSettings>>
    ) => {
      const updatedSettings = { ...settings, ...newSettings };
      setSettings(updatedSettings);

      try {
        await SecureStore.setItemAsync(
          STORAGE_KEYS.SETTINGS,
          JSON.stringify(updatedSettings)
        );
      } catch (error) {
        console.error('Error saving notification settings:', error);
      }
    },
    [settings]
  );

  // Load read status from storage
  const loadReadStatus = useCallback(async (): Promise<number[]> => {
    try {
      const readStatus = await SecureStore.getItemAsync(
        STORAGE_KEYS.READ_STATUS
      );
      return readStatus ? JSON.parse(readStatus) : [];
    } catch (error) {
      console.error('Error loading read status:', error);
      return [];
    }
  }, []);

  // Save read status to storage
  const saveReadStatus = useCallback(async (readIds: number[]) => {
    try {
      await SecureStore.setItemAsync(
        STORAGE_KEYS.READ_STATUS,
        JSON.stringify(readIds)
      );
    } catch (error) {
      console.error('Error saving read status:', error);
    }
  }, []);

  // Update last check timestamp
  const updateLastCheck = useCallback(async () => {
    try {
      await SecureStore.setItemAsync(
        STORAGE_KEYS.LAST_CHECK,
        Date.now().toString()
      );
    } catch (error) {
      console.error('Error updating last check:', error);
    }
  }, []);

  // Fetch notifications from API
  const fetchNotificationsData = useCallback(
    async (isRefresh = false): Promise<ParsedNotification[]> => {
      if (!username) return [];

      try {
        const rawNotifications = await fetchNotifications(username, 50);
        const parsed = rawNotifications.map(parseNotification);

        // Load read status
        const readNotifications = await loadReadStatus();
        const withReadStatus = parsed.map(notification => ({
          ...notification,
          read: readNotifications.includes(notification.id),
        }));

        // Filter by settings and sort chronologically
        const filtered = filterNotificationsBySettings(
          withReadStatus,
          settings
        );
        return sortNotifications(filtered, 'chronological');
      } catch (err) {
        throw new Error(
          err instanceof Error ? err.message : 'Failed to fetch notifications'
        );
      }
    },
    [username, settings, loadReadStatus]
  );

  // Main refresh function
  const refresh = useCallback(
    async (isManualRefresh = false) => {
      if (!username) return;

      // Prevent too frequent API calls (minimum 30 seconds between calls)
      const now = Date.now();
      if (!isManualRefresh && now - lastFetchTime.current < 30000) {
        return;
      }

      if (isManualRefresh) {
        setRefreshing(true);
      } else if (notifications.length === 0) {
        setLoading(true);
      }

      setError(null);

      try {
        const fetchedNotifications =
          await fetchNotificationsData(isManualRefresh);
        setNotifications(fetchedNotifications);
        lastFetchTime.current = now;

        if (isManualRefresh) {
          await updateLastCheck();
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to load notifications';
        setError(errorMessage);
        console.error('Error refreshing notifications:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [username, notifications.length, fetchNotificationsData, updateLastCheck]
  );

  // Mark single notification as read
  const markAsRead = useCallback(
    async (notificationId: number) => {
      const updatedNotifications = notifications.map(notification =>
        notification.id === notificationId
          ? { ...notification, read: true }
          : notification
      );
      setNotifications(updatedNotifications);

      const readIds = updatedNotifications.filter(n => n.read).map(n => n.id);
      await saveReadStatus(readIds);
    },
    [notifications, saveReadStatus]
  );

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    const updatedNotifications = notifications.map(notification => ({
      ...notification,
      read: true,
    }));
    setNotifications(updatedNotifications);

    const readIds = updatedNotifications.map(n => n.id);
    await saveReadStatus(readIds);
    await updateLastCheck();
  }, [notifications, saveReadStatus, updateLastCheck]);

  // Calculate unread count
  const unreadCount = getUnreadCount(notifications);

  // Set up automatic refresh when app becomes active
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground
        refresh(false);
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange
    );
    return () => subscription?.remove();
  }, [refresh]);

  // Set up periodic refresh when app is active
  useEffect(() => {
    if (!username) return;

    // Initial load
    refresh(false);

    // Set up periodic refresh every 2 minutes when app is active
    refreshInterval.current = setInterval(() => {
      if (AppState.currentState === 'active') {
        refresh(false);
      }
    }, 120000); // 2 minutes

    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
    };
  }, [username, refresh]);

  // Refresh when settings change
  useEffect(() => {
    if (username && notifications.length > 0) {
      // Re-filter existing notifications with new settings and sort chronologically
      const filtered = filterNotificationsBySettings(notifications, settings);
      const sorted = sortNotifications(filtered, 'chronological');
      setNotifications(sorted);
    }
  }, [settings]);

  return {
    notifications,
    unreadCount,
    loading,
    refreshing,
    error,
    settings,
    refresh: () => refresh(true),
    markAsRead,
    markAllAsRead,
    updateSettings,
  };
};
