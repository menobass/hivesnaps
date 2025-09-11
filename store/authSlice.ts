/**
 * Authentication Slice - Handles JWT token state management
 */

import { AuthState, AuthAction } from './types';

// Initial auth state
export const initialAuthState: AuthState = {
  jwtToken: null,
  refreshToken: null,
  isAuthenticated: false,
  lastAuthenticated: null,
  loading: false,
  error: null,
};

// Auth reducer
export const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'AUTH_SET_TOKEN':
      return {
        ...state,
        jwtToken: action.payload,
        isAuthenticated: !!action.payload,
        lastAuthenticated: action.payload ? Date.now() : null,
        error: null,
      };

    case 'AUTH_SET_REFRESH_TOKEN':
      return {
        ...state,
        refreshToken: action.payload,
        error: null,
      };

    case 'AUTH_SET_TOKENS':
      return {
        ...state,
        jwtToken: action.payload.token,
        refreshToken: action.payload.refreshToken,
        isAuthenticated: !!action.payload.token,
        lastAuthenticated: action.payload.token ? Date.now() : null,
        error: null,
      };

    case 'AUTH_SET_LOADING':
      return {
        ...state,
        loading: action.payload,
        error: action.payload ? null : state.error, // Clear error when starting to load
      };

    case 'AUTH_SET_ERROR':
      return {
        ...state,
        loading: false,
        error: action.payload,
      };

    case 'AUTH_CLEAR':
      return {
        ...initialAuthState,
      };

    default:
      return state;
  }
};

// Auth selectors
export const authSelectors = {
  getToken: (state: AuthState): string | null => state.jwtToken,
  getRefreshToken: (state: AuthState): string | null => state.refreshToken,
  isAuthenticated: (state: AuthState): boolean => state.isAuthenticated,
  isLoading: (state: AuthState): boolean => state.loading,
  getError: (state: AuthState): string | null => state.error,
  getLastAuthenticated: (state: AuthState): number | null => state.lastAuthenticated,
  
  // Check if authentication is recent (within last hour)
  isAuthenticationFresh: (state: AuthState): boolean => {
    if (!state.lastAuthenticated) return false;
    const oneHour = 60 * 60 * 1000;
    return (Date.now() - state.lastAuthenticated) < oneHour;
  },
};
