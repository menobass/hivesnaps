import { NotificationState, NotificationAction, CACHE_DURATIONS } from './types';

// Initial notification state
export const initialNotificationState: NotificationState = {
  unreadCount: 0,
  notifications: [],
  loading: false,
  lastFetched: 0,
};

// Notification reducer
export const notificationReducer = (state: NotificationState, action: NotificationAction): NotificationState => {
  switch (action.type) {
    case 'SET_UNREAD_COUNT':
      return {
        ...state,
        unreadCount: action.payload,
      };

    case 'SET_NOTIFICATIONS':
      return {
        ...state,
        notifications: action.payload,
        loading: false,
        lastFetched: Date.now(),
      };

    case 'SET_NOTIFICATION_LOADING':
      return {
        ...state,
        loading: action.payload,
      };

    default:
      return state;
  }
};

// Selectors
export const selectUnreadCount = (state: NotificationState) => state.unreadCount;

export const selectNotifications = (state: NotificationState) => state.notifications;

export const selectIsNotificationsCached = (state: NotificationState) => {
  const { lastFetched } = state;
  if (!lastFetched) return false;
  return Date.now() - lastFetched < CACHE_DURATIONS.NOTIFICATIONS;
};

export const selectIsNotificationsLoading = (state: NotificationState) => state.loading;
