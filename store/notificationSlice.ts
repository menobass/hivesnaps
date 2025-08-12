/**
 * Notification Slice - Manages user notifications with caching and read/unread state
 * Includes efficient selectors for notification management
 */

import { NotificationState, NotificationAction, Notification, CacheItem, CACHE_DURATIONS } from './types';

// Helper to create cache items with expiration
function createCacheItem<T>(data: T, duration: number): CacheItem<T> {
  const timestamp = Date.now();
  return {
    data,
    timestamp,
    expiresAt: timestamp + duration,
  };
}

// Helper to check if cache item is expired
function isCacheExpired<T>(item: CacheItem<T>): boolean {
  return Date.now() > item.expiresAt;
}

// Initial state
export const initialNotificationState: NotificationState = {
  notifications: null,
  unreadCount: 0,
  loading: false,
  error: null,
  lastChecked: 0,
};

// Notification reducer
export function notificationReducer(state: NotificationState, action: NotificationAction): NotificationState {
  switch (action.type) {
    case 'NOTIFICATION_SET_DATA':
      const notifications = createCacheItem(action.payload, CACHE_DURATIONS.NOTIFICATIONS);
      const unreadCount = action.payload.filter(n => !n.read).length;
      
      return {
        ...state,
        notifications,
        unreadCount,
        lastChecked: Date.now(),
        error: null,
      };

    case 'NOTIFICATION_MARK_READ':
      if (!state.notifications || isCacheExpired(state.notifications)) {
        return state;
      }

      const idsToMark = Array.isArray(action.payload) ? action.payload : [action.payload];
      const updatedNotifications = state.notifications.data.map(notification => 
        idsToMark.includes(notification.id) 
          ? { ...notification, read: true }
          : notification
      );

      const newUnreadCount = updatedNotifications.filter(n => !n.read).length;

      return {
        ...state,
        notifications: {
          ...state.notifications,
          data: updatedNotifications,
        },
        unreadCount: newUnreadCount,
      };

    case 'NOTIFICATION_SET_LOADING':
      return {
        ...state,
        loading: action.payload,
      };

    case 'NOTIFICATION_SET_ERROR':
      return {
        ...state,
        error: action.payload,
        loading: false,
      };

    case 'NOTIFICATION_UPDATE_UNREAD_COUNT':
      return {
        ...state,
        unreadCount: action.payload,
      };

    case 'NOTIFICATION_CLEAR_CACHE':
      return {
        ...state,
        notifications: null,
        unreadCount: 0,
        error: null,
        lastChecked: 0,
      };

    default:
      return state;
  }
}

// Selectors
export const notificationSelectors = {
  // Get all notifications with cache check
  getNotifications: (state: NotificationState): Notification[] | null => {
    if (!state.notifications || isCacheExpired(state.notifications)) {
      return null;
    }
    return state.notifications.data;
  },

  // Get unread notifications
  getUnreadNotifications: (state: NotificationState): Notification[] => {
    const notifications = notificationSelectors.getNotifications(state);
    if (!notifications) return [];
    return notifications.filter(n => !n.read);
  },

  // Get read notifications
  getReadNotifications: (state: NotificationState): Notification[] => {
    const notifications = notificationSelectors.getNotifications(state);
    if (!notifications) return [];
    return notifications.filter(n => n.read);
  },

  // Get notifications by type
  getNotificationsByType: (state: NotificationState, type: Notification['type']): Notification[] => {
    const notifications = notificationSelectors.getNotifications(state);
    if (!notifications) return [];
    return notifications.filter(n => n.type === type);
  },

  // Get notifications from specific user
  getNotificationsFromUser: (state: NotificationState, username: string): Notification[] => {
    const notifications = notificationSelectors.getNotifications(state);
    if (!notifications) return [];
    return notifications.filter(n => n.from === username);
  },

  // Get recent notifications (last 24 hours)
  getRecentNotifications: (state: NotificationState): Notification[] => {
    const notifications = notificationSelectors.getNotifications(state);
    if (!notifications) return [];
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    return notifications.filter(n => n.timestamp > oneDayAgo);
  },

  // Get unread count
  getUnreadCount: (state: NotificationState): number => state.unreadCount,

  // Get loading state
  isLoading: (state: NotificationState): boolean => state.loading,

  // Get error state
  getError: (state: NotificationState): string | null => state.error,

  // Check if notifications need refresh
  needsRefresh: (state: NotificationState): boolean => {
    return !state.notifications || isCacheExpired(state.notifications);
  },

  // Get last checked timestamp
  getLastChecked: (state: NotificationState): number => state.lastChecked,

  // Check if there are any unread notifications
  hasUnreadNotifications: (state: NotificationState): boolean => state.unreadCount > 0,

  // Get notification by ID
  getNotificationById: (state: NotificationState, id: string): Notification | null => {
    const notifications = notificationSelectors.getNotifications(state);
    if (!notifications) return null;
    return notifications.find(n => n.id === id) || null;
  },

  // Get grouped notifications by type
  getGroupedNotifications: (state: NotificationState): Record<Notification['type'], Notification[]> => {
    const notifications = notificationSelectors.getNotifications(state);
    if (!notifications) {
      return {
        follow: [],
        unfollow: [],
        vote: [],
        comment: [],
        mention: [],
        reblog: [],
      };
    }

    return notifications.reduce((groups, notification) => {
      if (!groups[notification.type]) {
        groups[notification.type] = [];
      }
      groups[notification.type].push(notification);
      return groups;
    }, {} as Record<Notification['type'], Notification[]>);
  },

  // Get cache info for debugging
  getCacheInfo: (state: NotificationState) => ({
    hasNotifications: !!state.notifications,
    notificationCount: state.notifications?.data.length || 0,
    isExpired: state.notifications ? isCacheExpired(state.notifications) : true,
    lastChecked: state.lastChecked,
    timeSinceLastCheck: Date.now() - state.lastChecked,
    unreadCount: state.unreadCount,
  }),
};
