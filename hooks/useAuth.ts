/**
 * Authentication Hook - Provides easy access to auth functionality
 */

import { useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useAppStore } from '../store/context';
import { authService } from '../services/AuthService';

export const useAuth = () => {
  const { 
    setAuthTokens,
    setAuthLoading, 
    setAuthError, 
    clearAuth,
    selectors 
  } = useAppStore();

  const {
    getAuthToken,
    getAuthRefreshToken,
    isAuthenticated,
    isAuthLoading,
    getAuthError,
    isAuthenticationFresh,
  } = selectors;

  /**
   * Authenticate user and get JWT token
   */
  const authenticate = useCallback(async (username: string, postingKey: string): Promise<boolean> => {
    setAuthLoading(true);
    setAuthError(null);

    try {
      const result = await authService.authenticate(username, postingKey);
      
      if (result.success && result.token) {
        // Store both JWT token and refresh token
        const refreshToken = authService.getRefreshToken();
        setAuthTokens({ 
          token: result.token, 
          refreshToken: refreshToken 
        });
        setAuthLoading(false);
        return true;
      } else {
        setAuthError(result.error || 'Authentication failed');
        setAuthLoading(false);
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown authentication error';
      setAuthError(errorMessage);
      setAuthLoading(false);
      return false;
    }
  }, [setAuthTokens, setAuthLoading, setAuthError]);

  /**
   * Logout user and clear all auth data
   */
  const logout = useCallback(async () => {
    // Clear tokens from auth service
    authService.logout();
    
    // Clear tokens from context
    clearAuth();
    
    // Clear stored credentials from SecureStore
    try {
      await SecureStore.deleteItemAsync('hive_username');
      await SecureStore.deleteItemAsync('hive_posting_key');
    } catch (error) {
      console.error('[useAuth] Failed to clear stored credentials:', error);
    }
  }, [clearAuth]);

  /**
   * Get current JWT token for API calls
   */
  const getCurrentToken = useCallback((): string | null => {
    return authService.getToken() || getAuthToken();
  }, [getAuthToken]);

  /**
   * Check if user needs to authenticate
   */
  const needsAuthentication = useCallback((): boolean => {
    return !isAuthenticated() || !getCurrentToken();
  }, [isAuthenticated, getCurrentToken]);

  return {
    // State
    isAuthenticated: isAuthenticated(),
    isLoading: isAuthLoading(),
    error: getAuthError(),
    token: getCurrentToken(),
    needsAuthentication: needsAuthentication(),
    isAuthenticationFresh: isAuthenticationFresh(),

    // Actions
    authenticate,
    logout,
    clearError: () => setAuthError(null),

    // Utilities
    getCurrentToken,
  };
};
