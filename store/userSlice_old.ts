/**
 * User Slice - Manages user profiles, following lists, and followers
 * Includes caching with expiration and efficient selectors
 */

import { UserState, UserAction, UserProfile, CacheItem, CACHE_DURATIONS } from './types';

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
export const initialUserState: UserState = {
  currentUser: null,
  profiles: {},
  followingLists: {},
  followerLists: {},
  loading: {
    profile: {},
    following: {},
    followers: {},
  },
  errors: {
    profile: {},
    following: {},
    followers: {},
  },
};

// User reducer
export const userReducer = (state: UserState, action: UserAction): UserState => {
  switch (action.type) {
    case 'SET_CURRENT_USER':
      return {
        ...state,
        currentUser: action.payload,
        loading: {
          ...state.loading,
          currentUser: false,
        },
      };

    case 'SET_FOLLOWING_LIST':
      const { username, following } = action.payload;
      return {
        ...state,
        followingLists: {
          ...state.followingLists,
          [username]: following,
        },
        loading: {
          ...state.loading,
          following: {
            ...state.loading.following,
            [username]: false,
          },
        },
        lastFetched: {
          ...state.lastFetched,
          following: {
            ...state.lastFetched.following,
            [username]: Date.now(),
          },
        },
      };

    case 'SET_USER_PROFILE':
      const user = action.payload;
      return {
        ...state,
        users: {
          ...state.users,
          [user.username]: user,
        },
        loading: {
          ...state.loading,
          userProfile: {
            ...state.loading.userProfile,
            [user.username]: false,
          },
        },
        lastFetched: {
          ...state.lastFetched,
          userProfile: {
            ...state.lastFetched.userProfile,
            [user.username]: Date.now(),
          },
        },
      };

    case 'SET_LOADING_FOLLOWING':
      return {
        ...state,
        loading: {
          ...state.loading,
          following: {
            ...state.loading.following,
            [action.payload.username]: action.payload.loading,
          },
        },
      };

    case 'SET_LOADING_USER_PROFILE':
      return {
        ...state,
        loading: {
          ...state.loading,
          userProfile: {
            ...state.loading.userProfile,
            [action.payload.username]: action.payload.loading,
          },
        },
      };

    case 'CLEAR_USER_DATA':
      return initialUserState;

    default:
      return state;
  }
};

// Selectors
export const selectCurrentUser = (state: UserState) => state.currentUser;

export const selectFollowingList = (state: UserState, username: string) => 
  state.followingLists[username] || [];

export const selectUserProfile = (state: UserState, username: string) => 
  state.profiles[username];

export const selectIsFollowingListCached = (state: UserState, username: string) => {
  const lastFetched = state.lastFetched.following[username];
  if (!lastFetched) return false;
  return Date.now() - lastFetched < CACHE_DURATIONS.FOLLOWING_LIST;
};

export const selectIsUserProfileCached = (state: UserState, username: string) => {
  const lastFetched = state.lastFetched.userProfile[username];
  if (!lastFetched) return false;
  return Date.now() - lastFetched < CACHE_DURATIONS.USER_PROFILE;
};

export const selectIsLoadingFollowing = (state: UserState, username: string) => 
  state.loading.following[username] || false;

export const selectIsLoadingUserProfile = (state: UserState, username: string) => 
  state.loading.userProfile[username] || false;
