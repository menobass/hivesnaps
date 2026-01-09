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

import { useMutedList, useNotifications as useNotificationStore } from '../store/context';
import { fetchMutedList } from '../services/HiveMuteService';

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

  // Get store's setNotificationUnreadCount to update bell badge
  const { setNotificationUnreadCount } = useNotificationStore();

  // Use shared state for muted list (same pattern as FeedScreen)
  const {
    mutedList,
    needsRefresh: needsMutedRefresh,
    setMutedList,
    setLoading: setMutedLoading,
    setError: setMutedError,
  } = useMutedList(username || '');

  // Ensure muted list is loaded
  const ensureMutedListLoaded = useCallback(async () => {
    if (!username) return;

    if (!mutedList || mutedList.length === 0 || needsMutedRefresh) {
      if (__DEV__) {
        console.log('[useNotifications] Loading muted list for:', username);
      }

      try {
        setMutedLoading(true);
        const mutedSet = await fetchMutedList(username);
        const mutedArray = Array.from(mutedSet);
        setMutedList(mutedArray);
        setMutedError(null);

        if (__DEV__) {
          console.log('[useNotifications] Loaded muted list:', mutedArray.length, 'users');
        }
      } catch (error) {
        console.error('[useNotifications] Error loading muted list:', error);
        setMutedError(error instanceof Error ? error.message : 'Failed to load muted list');
      } finally {
        setMutedLoading(false);
      }
    }
  }, [username, mutedList, needsMutedRefresh, setMutedList, setMutedLoading, setMutedError]);

  // Load muted list on mount and when username changes
  useEffect(() => {
    ensureMutedListLoaded();
  }, [ensureMutedListLoaded]);

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
        if (__DEV__) {
          console.log('[useNotifications] Fetching notifications for:', username);
        }

        // Fetch notifications from Hive API
        const rawNotifications = await fetchNotifications(username, 50);
        const parsed = rawNotifications.map(parseNotification);

        // Load read status
        const readNotifications = await loadReadStatus();
        const withReadStatus = parsed.map((notification: ParsedNotification) => ({
          ...notification,
          read: readNotifications.includes(notification.id),
        }));

        // Filter out notifications from muted/blacklisted users (same pattern as FeedScreen)
        const notMuted = withReadStatus.filter((notification: ParsedNotification) => {
          if (!notification.actionUser) return true; // Keep notifications without actionUser
          const isMuted = mutedList && mutedList.includes(notification.actionUser);

          return !isMuted;
        });

        // Filter by settings and sort chronologically
        const filtered = filterNotificationsBySettings(
          notMuted,
          settings
        );
        return sortNotifications(filtered, 'chronological');
      } catch (err) {
        throw new Error(
          err instanceof Error ? err.message : 'Failed to fetch notifications'
        );
      }
    },
    [username, settings, loadReadStatus, mutedList] // Add mutedList to dependencies
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

        // Update store's unread count so FeedScreen bell shows correct number
        const newUnreadCount = getUnreadCount(fetchedNotifications);
        setNotificationUnreadCount(newUnreadCount);

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
    [username, notifications.length, fetchNotificationsData, updateLastCheck, setNotificationUnreadCount]
  );

  // Mark single notification as read
  const markAsRead = useCallback(
    async (notificationId: number) => {
      let changed = false;
      const updatedNotifications = notifications.map(notification => {
        if (notification.id === notificationId && !notification.read) {
          changed = true;
          return { ...notification, read: true };
        }
        return notification;
      });
      setNotifications(updatedNotifications);

      const readIds = updatedNotifications.filter(n => n.read).map(n => n.id);
      await saveReadStatus(readIds);

      // Update store's unread count so FeedScreen bell updates
      if (changed) {
        const newUnreadCount = updatedNotifications.filter(n => !n.read).length;
        setNotificationUnreadCount(newUnreadCount);
      }
    },
    [notifications, saveReadStatus, setNotificationUnreadCount]
  );

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    const hadUnread = notifications.some(n => !n.read);

    const updatedNotifications = notifications.map(notification => ({
      ...notification,
      read: true,
    }));
    setNotifications(updatedNotifications);

    const readIds = updatedNotifications.map(n => n.id);
    await saveReadStatus(readIds);
    await updateLastCheck();

    // Update store's unread count to 0 so FeedScreen bell updates
    if (hadUnread) {
      setNotificationUnreadCount(0);
    }
  }, [notifications, saveReadStatus, updateLastCheck, setNotificationUnreadCount]);

  // Get unread count from store (source of truth, updated when notifications change)
  const { unreadCount } = useNotificationStore();

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
