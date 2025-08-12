/**
 * Root Reducer - Combines all slices and manages the overall app state
 * Provides the main reducer function and initial state for the app
 */

import { AppState, AppAction } from './types';
import { userReducer, initialUserState } from './userSlice';
import { hiveReducer, initialHiveState } from './hiveSlice';
import { notificationReducer, initialNotificationState } from './notificationSlice';

// Initial app state
export const initialAppState: AppState = {
  user: initialUserState,
  hive: initialHiveState,
  notifications: initialNotificationState,
};

// Root reducer
export function appReducer(state: AppState, action: AppAction): AppState {
  // Route actions to appropriate slice reducers
  if (action.type.startsWith('USER_')) {
    return {
      ...state,
      user: userReducer(state.user, action as any),
    };
  }

  if (action.type.startsWith('HIVE_')) {
    return {
      ...state,
      hive: hiveReducer(state.hive, action as any),
    };
  }

  if (action.type.startsWith('NOTIFICATION_')) {
    return {
      ...state,
      notifications: notificationReducer(state.notifications, action as any),
    };
  }

  // Return unchanged state for unknown actions
  return state;
}

// Root selectors that work across slices
export const appSelectors = {
  // Get current user's following list
  getCurrentUserFollowing: (state: AppState): string[] | null => {
    const currentUser = state.user.currentUser;
    if (!currentUser) return null;
    
    const followingCache = state.user.followingLists[currentUser];
    if (!followingCache || Date.now() > followingCache.expiresAt) {
      return null;
    }
    return followingCache.data;
  },

  // Check if current user follows someone
  doesCurrentUserFollow: (state: AppState, username: string): boolean | null => {
    const following = appSelectors.getCurrentUserFollowing(state);
    if (!following) return null;
    return following.includes(username);
  },

  // Get current user's profile
  getCurrentUserProfile: (state: AppState) => {
    const currentUser = state.user.currentUser;
    if (!currentUser) return null;
    
    const profileCache = state.user.profiles[currentUser];
    if (!profileCache || Date.now() > profileCache.expiresAt) {
      return null;
    }
    return profileCache.data;
  },

  // Get overall loading state
  isAnyLoading: (state: AppState): boolean => {
    // Check user loading states
    const userLoading = Object.values(state.user.loading).some(loadingMap => 
      Object.values(loadingMap).some(Boolean)
    );
    
    // Check hive loading states
    const hiveLoading = state.hive.loading.data || 
      Object.values(state.hive.loading.posts).some(Boolean) ||
      Object.values(state.hive.loading.tags).some(Boolean);
    
    // Check notification loading
    const notificationLoading = state.notifications.loading;
    
    return userLoading || hiveLoading || notificationLoading;
  },

  // Get global error state
  getGlobalErrors: (state: AppState): string[] => {
    const errors: string[] = [];
    
    // Collect user errors
    Object.values(state.user.errors).forEach(errorMap => {
      Object.values(errorMap).forEach(error => {
        if (error) errors.push(error);
      });
    });
    
    // Collect hive errors
    if (state.hive.errors.data) errors.push(state.hive.errors.data);
    Object.values(state.hive.errors.posts).forEach(error => {
      if (error) errors.push(error);
    });
    Object.values(state.hive.errors.tags).forEach(error => {
      if (error) errors.push(error);
    });
    
    // Collect notification errors
    if (state.notifications.error) errors.push(state.notifications.error);
    
    return errors;
  },

  // Debug helpers
  getCacheStats: (state: AppState) => ({
    user: {
      profiles: Object.keys(state.user.profiles).length,
      followingLists: Object.keys(state.user.followingLists).length,
      followerLists: Object.keys(state.user.followerLists).length,
    },
    hive: {
      posts: Object.keys(state.hive.posts).length,
      postsByTag: Object.keys(state.hive.postsByTag).length,
    },
    notifications: {
      hasData: !!state.notifications.notifications,
      unreadCount: state.notifications.unreadCount,
    },
  }),
};
